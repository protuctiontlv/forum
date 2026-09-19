import os
import re
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import httpx

from fastapi import (
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pymongo import ASCENDING, DESCENDING, MongoClient
from gridfs import GridFS
from bson import ObjectId


# ============================================================
# CONFIGURATION
# ============================================================

MONGODB_URI = os.getenv("MONGODB_URI")

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI environment variable is not set.")

DATABASE_NAME = os.getenv("MONGODB_DATABASE", "tlv_production")

MAX_MESSAGE_LENGTH = 1000
MAX_USERNAME_LENGTH = 30
MAX_AGE = 120
MIN_AGE = 1
MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5 MB

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="TLV-Production Forum",
    version="1.0.0",
)


# ============================================================
# MONGODB
# ============================================================

mongo_client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=10000,
)

db = mongo_client[DATABASE_NAME]

users_collection = db["users"]
messages_collection = db["messages"]
sessions_collection = db["sessions"]

# GridFS stores uploaded avatars inside MongoDB.
avatar_storage = GridFS(db, collection="avatars")


# ============================================================
# DATABASE INDEXES
# ============================================================

users_collection.create_index(
    [("username_lower", ASCENDING)],
    unique=True,
)

messages_collection.create_index(
    [("created_at", DESCENDING)]
)

sessions_collection.create_index(
    [("token", ASCENDING)],
    unique=True,
)

# Automatically remove expired sessions after 30 days.
sessions_collection.create_index(
    [("expires_at", ASCENDING)],
    expireAfterSeconds=0,
)


# ============================================================
# WEBSOCKET CONNECTION MANAGER
# ============================================================

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        disconnected = []

        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            self.disconnect(connection)


manager = ConnectionManager()


# ============================================================
# HELPERS
# ============================================================

def utc_now():
    return datetime.now(timezone.utc)


def clean_username(username: str) -> str:
    username = username.strip()

    if not username:
        raise HTTPException(
            status_code=400,
            detail="Username is required.",
        )

    if len(username) > MAX_USERNAME_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Username must be at most {MAX_USERNAME_LENGTH} characters.",
        )

    # Allow letters, numbers, spaces, underscore, hyphen and dot.
    if not re.fullmatch(r"[\w\s.\-]+", username, re.UNICODE):
        raise HTTPException(
            status_code=400,
            detail="Username contains unsupported characters.",
        )

    return username


def clean_age(age: int) -> int:
    if age < MIN_AGE or age > MAX_AGE:
        raise HTTPException(
            status_code=400,
            detail=f"Age must be between {MIN_AGE} and {MAX_AGE}.",
        )

    return age


def country_flag(country_code: str | None) -> str:
    if not country_code or len(country_code) != 2:
        return "🌐"

    code = country_code.upper()

    if not code.isalpha():
        return "🌐"

    return "".join(
        chr(127397 + ord(letter))
        for letter in code
    )

async def reverse_geocode(
    latitude: float,
    longitude: float,
):
    url = (
        "https://api-bdc.net/data/reverse-geocode"
    )

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "localityLanguage": "en",
    }

    try:

        async with httpx.AsyncClient(
            timeout=10.0
        ) as client:

            response = await client.get(
                url,
                params=params,
            )

        response.raise_for_status()

        data = response.json()

        country_code = data.get(
            "countryCode"
        )

        country_name = data.get(
            "countryName"
        )

        if not country_code:
            return None, None

        return (
            country_code.upper(),
            country_name,
        )

    except Exception as exc:

        print(
            "Reverse geocoding error:",
            exc,
        )

        return None, None

async def locate_by_ip(
    request: Request,
):
    forwarded_for = request.headers.get(
        "x-forwarded-for"
    )

    if forwarded_for:
        client_ip = (
            forwarded_for
            .split(",")[0]
            .strip()
        )
    else:
        client_ip = (
            request.client.host
            if request.client
            else None
        )

    if not client_ip:
        return None, None

    url = (
        f"https://countries.dev/ip/"
        f"{client_ip}"
    )

    try:
        async with httpx.AsyncClient(
            timeout=10.0
        ) as client:

            response = await client.get(
                url
            )

        response.raise_for_status()

        data = response.json()

        country = data.get(
            "country"
        )

        if isinstance(country, dict):

            country_code = country.get(
                "code"
            )

            country_name = country.get(
                "name"
            )

        else:
            country_code = data.get(
                "countryCode"
            )

            country_name = data.get(
                "countryName"
            )

        if not country_code:
            return None, None

        return (
            country_code.upper(),
            country_name,
        )

    except Exception as exc:

        print(
            "IP geolocation error:",
            exc,
        )

        return None, None

def serialize_user(user):
    country_code = user.get(
        "location_country_code"
    )

    avatar = user.get("avatar")

    avatar_url = None
    avatar_file_id = None

    if isinstance(avatar, dict):

        if avatar.get("type") == "url":

            avatar_url = avatar.get(
                "value"
            )

        elif avatar.get("type") == "file":

            avatar_file_id = avatar.get(
                "value"
            )


    # --------------------------------------------------------
    # CREATED AT
    # --------------------------------------------------------

    created_at = user.get(
        "created_at"
    )

    if isinstance(
        created_at,
        datetime
    ):

        created_at = (
            created_at
            .isoformat()
        )


    # --------------------------------------------------------
    # RESULT
    # --------------------------------------------------------

    return {
        "id": str(
            user["_id"]
        ),
    
        "username": user.get(
            "username",
            ""
        ),
    
        "age": user.get(
            "age"
        ),
    
        "avatar_url": avatar_url,
    
        "avatar_file_id":
            avatar_file_id,
    
        "avatar_decoration":
            user.get(
                "avatar_decoration"
            ),
    
        "created_at":
            created_at,
    
        "location_enabled":
            user.get(
                "location_enabled",
                False
            ),
    
        "country_code":
            country_code,
    
        "country_name":
            user.get(
                "location_country_name"
            ),
    
        "country_flag":
            country_flag(
                country_code
            ),
    }

def get_session_token(request: Request) -> Optional[str]:
    return request.cookies.get("tlv_session")


def get_current_user(request: Request):
    token = get_session_token(request)

    if not token:
        return None

    session = sessions_collection.find_one({"token": token})

    if not session:
        return None

    user = users_collection.find_one(
        {"_id": session["user_id"]}
    )

    return user


def create_session(user_id: ObjectId):
    token = secrets.token_urlsafe(48)

    sessions_collection.insert_one(
        {
            "token": token,
            "user_id": user_id,
            "created_at": utc_now(),
            "expires_at": utc_now().replace(
                microsecond=0
            ).replace(
                year=utc_now().year,
                month=utc_now().month,
                day=utc_now().day,
            ),
        }
    )

    # Replace expiration with +30 days.
    from datetime import timedelta

    sessions_collection.update_one(
        {"token": token},
        {
            "$set": {
                "expires_at": utc_now() + timedelta(days=30)
            }
        },
    )

    return token


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key="tlv_session",
        value=token,
        max_age=30 * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="lax",
    )


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
def startup_event():
    mongo_client.admin.command("ping")
    print("MongoDB connection successful.")
    print(f"Database: {DATABASE_NAME}")


# ============================================================
# FRONTEND
# ============================================================

@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="static",
)


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
async def health():
    try:
        mongo_client.admin.command("ping")

        return {
            "status": "ok",
            "database": "connected",
        }

    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "database": "disconnected",
                "error": str(exc),
            },
        )


# ============================================================
# CURRENT USER
# ============================================================

@app.get("/api/me")
async def get_me(request: Request):
    user = get_current_user(request)

    if not user:
        return {
            "authenticated": False,
            "user": None,
        }

    return {
        "authenticated": True,
        "user": serialize_user(user),
    }


# ============================================================
# REGISTRATION
# ============================================================

@app.post("/api/register")
async def register(
    username: str = Form(...),
    age: int = Form(...),
    avatar_url: str = Form(""),
    avatar_file: Optional[UploadFile] = File(None),
):
    username = clean_username(username)
    age = clean_age(age)

    username_lower = username.lower()

    existing_user = users_collection.find_one(
        {"username_lower": username_lower}
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="This username is already taken.",
        )

    avatar = None

    # --------------------------------------------------------
    # AVATAR URL
    # --------------------------------------------------------

    avatar_url = avatar_url.strip()

    if avatar_url:
        if not (
            avatar_url.startswith("http://")
            or avatar_url.startswith("https://")
        ):
            raise HTTPException(
                status_code=400,
                detail="Avatar URL must start with http:// or https://.",
            )

        avatar = {
            "type": "url",
            "value": avatar_url,
        }

    # --------------------------------------------------------
    # AVATAR FILE
    # --------------------------------------------------------

    if avatar_file and avatar_file.filename:
        if not avatar_file.content_type:
            raise HTTPException(
                status_code=400,
                detail="Invalid avatar file.",
            )

        allowed_types = {
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
        }

        if avatar_file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail="Avatar must be JPG, PNG, GIF or WEBP.",
            )

        file_data = await avatar_file.read()

        if len(file_data) > MAX_AVATAR_SIZE:
            raise HTTPException(
                status_code=400,
                detail="Avatar file must be 5 MB or smaller.",
            )

        file_id = avatar_storage.put(
            file_data,
            filename=avatar_file.filename,
            content_type=avatar_file.content_type,
        )

        avatar = {
            "type": "file",
            "value": str(file_id),
        }

    # --------------------------------------------------------
    # CREATE USER
    # --------------------------------------------------------

    user_document = {
        "username": username,
        "username_lower": username_lower,
        "age": age,
        "avatar": avatar,
    
        # Selected animated avatar decoration.
        "avatar_decoration": None,
    
        # ----------------------------------------------------
        # PROFILE / LOCATION
        # ----------------------------------------------------
    
        # User can enable this later from profile settings.
        "location_enabled": False,
    
        # ISO 3166-1 alpha-2 country code.
        # Examples: IL, US, GB, JP, TV, KI, PW.
        "location_country_code": None,
    
        # Human-readable country name.
        "location_country_name": None,
    
        # Server-side registration date.
        "created_at": utc_now(),
    }

    try:
        result = users_collection.insert_one(user_document)

    except Exception as exc:
        if "duplicate key" in str(exc).lower():
            raise HTTPException(
                status_code=409,
                detail="This username is already taken.",
            )

        raise HTTPException(
            status_code=500,
            detail="Could not create account.",
        )

    # --------------------------------------------------------
    # CREATE SESSION
    # --------------------------------------------------------

    token = create_session(result.inserted_id)

    user = users_collection.find_one(
        {"_id": result.inserted_id}
    )

    response = JSONResponse(
        content={
            "success": True,
            "user": serialize_user(user),
        }
    )

    set_session_cookie(response, token)

    return response

# ============================================================
# LOGIN
# ============================================================

@app.post("/api/login")
async def login(
    username: str = Form(...),
):
    username = clean_username(username)

    user = users_collection.find_one(
        {"username_lower": username.lower()}
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    token = create_session(user["_id"])

    response = JSONResponse(
        content={
            "success": True,
            "user": serialize_user(user),
        }
    )

    set_session_cookie(response, token)

    return response


# ============================================================
# LOGOUT
# ============================================================

@app.post("/api/logout")
async def logout(request: Request):
    token = get_session_token(request)

    if token:
        sessions_collection.delete_one(
            {"token": token}
        )

    response = JSONResponse(
        content={
            "success": True
        }
    )

    response.delete_cookie("tlv_session")

    return response


# ============================================================
# AVATAR FROM MONGODB GRIDFS
# ============================================================

@app.get("/api/avatar/{file_id}")
async def get_avatar(file_id: str):
    try:
        object_id = ObjectId(file_id)
    except Exception:
        raise HTTPException(
            status_code=404,
            detail="Avatar not found.",
        )

    try:
        grid_file = avatar_storage.get(object_id)
    except Exception:
        raise HTTPException(
            status_code=404,
            detail="Avatar not found.",
        )

    content = grid_file.read()

    return Response(
        content=content,
        media_type=grid_file.content_type
        or "application/octet-stream",
        headers={
            "Cache-Control": "public, max-age=86400"
        },
    )


# ============================================================
# MESSAGE HISTORY
# ============================================================

@app.get("/api/messages")
async def get_messages(request: Request):
    user = get_current_user(request)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required.",
        )

    messages = list(
        messages_collection
        .find()
        .sort("created_at", DESCENDING)
        .limit(100)
    )

    messages.reverse()

    result = []

    for message in messages:
        result.append(
            {
                "id": str(message["_id"]),
                "user_id": str(message["user_id"]),
                "username": message["username"],
                "avatar": message.get("avatar"),
                "text": message["text"],
                "created_at": message["created_at"].isoformat(),
            }
        )

    return {
        "messages": result
    }

@app.get("/api/users/{user_id}")
async def get_public_user_profile(user_id: str):
    try:
        object_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = users_collection.find_one({"_id": object_id})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return serialize_user(user)

@app.put("/api/profile")
async def update_profile(
    request: Request,
    username: str = Form(...),
    age: int = Form(...),
    avatar_url: str = Form(""),
    avatar_decoration: str = Form(""),
    avatar_file: Optional[UploadFile] = File(None),
    ):
    user = get_current_user(request)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
        )

    username = clean_username(username)
    age = clean_age(age)

    existing = users_collection.find_one(
        {
            "username_lower": username.lower(),
            "_id": {"$ne": user["_id"]},
        }
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="This username is already taken.",
        )

    update_data = {
        "username": username,
        "username_lower": username.lower(),
        "age": age,
        "avatar_decoration": avatar_decoration.strip(),
    }

    # --------------------------------------------------------
    # AVATAR URL
    # --------------------------------------------------------

    avatar_url = avatar_url.strip()

    if avatar_url:
        if not (
            avatar_url.startswith("http://")
            or avatar_url.startswith("https://")
        ):
            raise HTTPException(
                status_code=400,
                detail="Avatar URL must start with http:// or https://.",
            )

        update_data["avatar"] = {
            "type": "url",
            "value": avatar_url,
        }

    # --------------------------------------------------------
    # AVATAR FILE
    # --------------------------------------------------------

    elif avatar_file and avatar_file.filename:
        allowed_types = {
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
        }

        if avatar_file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail="Avatar must be JPG, PNG, GIF or WEBP.",
            )

        file_data = await avatar_file.read()

        if len(file_data) > MAX_AVATAR_SIZE:
            raise HTTPException(
                status_code=400,
                detail="Avatar file must be 5 MB or smaller.",
            )

        file_id = avatar_storage.put(
            file_data,
            filename=avatar_file.filename,
            content_type=avatar_file.content_type,
        )

        update_data["avatar"] = {
            "type": "file",
            "value": str(file_id),
        }

    # --------------------------------------------------------
    # UPDATE USER
    # --------------------------------------------------------

    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": update_data},
    )

    updated_user = users_collection.find_one(
        {"_id": user["_id"]}
    )

    return serialize_user(updated_user)

@app.put("/api/profile/location")
async def update_location(
    request: Request,
    enabled: bool = Form(...),
    country_code: str = Form(""),
    country_name: str = Form(""),
):
    user = get_current_user(request)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
        )

    print(
        "LOCATION REQUEST:",
        {
            "enabled": enabled,
            "country_code": country_code,
            "country_name": country_name,
        }
    )

    if not enabled:
        users_collection.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "location_enabled": False,
                    "location_country_code": None,
                    "location_country_name": None,
                }
            },
        )

        updated_user = users_collection.find_one(
            {"_id": user["_id"]}
        )

        return serialize_user(
            updated_user
        )

    country_code = (
        country_code.strip().upper()
    )

    country_name = (
        country_name.strip()
    )

    if not country_code:
        raise HTTPException(
            status_code=400,
            detail="Country code was not provided.",
        )

    if (
        len(country_code) != 2
        or not country_code.isalpha()
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid country code.",
        )

    if not country_name:
        country_name = country_code

    users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "location_enabled": True,
                "location_country_code": country_code,
                "location_country_name": country_name,
            }
        },
    )

    updated_user = users_collection.find_one(
        {"_id": user["_id"]}
    )

    print(
        "LOCATION SAVED:",
        {
            "country_code": country_code,
            "country_name": country_name,
        }
    )

    return serialize_user(
        updated_user
    )

# ============================================================
# WEBSOCKET CHAT
# ============================================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        while True:
            data = await websocket.receive_json()

            # ------------------------------------------------
            # MESSAGE
            # ------------------------------------------------

            if data.get("type") != "message":
                continue

            token = data.get("token")

            # The frontend sends the session token when opening
            # the websocket.
            #
            # Normally the HTTP-only cookie is unavailable to
            # JavaScript, so the backend can also authenticate
            # through the websocket cookie itself.
            #
            # Prefer cookie.
            cookie_token = websocket.cookies.get(
                "tlv_session"
            )

            token = cookie_token or token

            if not token:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": "Authentication required.",
                    }
                )
                continue

            session = sessions_collection.find_one(
                {"token": token}
            )

            if not session:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": "Invalid session.",
                    }
                )
                continue

            user = users_collection.find_one(
                {"_id": session["user_id"]}
            )

            if not user:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": "User not found.",
                    }
                )
                continue

            text = str(data.get("text", "")).strip()

            if not text:
                continue

            if len(text) > MAX_MESSAGE_LENGTH:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": (
                            f"Message is limited to "
                            f"{MAX_MESSAGE_LENGTH} characters."
                        ),
                    }
                )
                continue

            # ------------------------------------------------
            # SAVE MESSAGE
            # ------------------------------------------------

            message_document = {
                "user_id": user["_id"],
                "username": user["username"],
                "avatar": user.get("avatar"),
                "text": text,
                "created_at": utc_now(),
            }

            result = messages_collection.insert_one(
                message_document
            )

            message = {
                "type": "message",
                "id": str(result.inserted_id),
                "user_id": str(user["_id"]),
                "username": user["username"],
                "avatar": user.get("avatar"),
                "text": text,
                "created_at": message_document[
                    "created_at"
                ].isoformat(),
            }

            # ------------------------------------------------
            # BROADCAST
            # ------------------------------------------------

            await manager.broadcast(message)

    except WebSocketDisconnect:
        manager.disconnect(websocket)

    except Exception as exc:
        print("WebSocket error:", exc)
        manager.disconnect(websocket)
