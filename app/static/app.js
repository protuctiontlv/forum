// ============================================================
// TLV-PRODUCTION FORUM
// Frontend
// ============================================================

const state = {
    user: null,
    socket: null,
    connected: false,
    reconnectTimer: null,
};


// ============================================================
// DOM
// ============================================================

const authScreen = document.getElementById("auth-screen");
const forumScreen = document.getElementById("forum-screen");

const registerForm = document.getElementById("register-form");
const registerButton = document.getElementById("register-button");
const registerError = document.getElementById("register-error");

const avatarUrl = document.getElementById("avatar-url");
const avatarFile = document.getElementById("avatar-file");

const avatarUrlContainer =
    document.getElementById("avatar-url-container");

const avatarFileContainer =
    document.getElementById("avatar-file-container");

const avatarTabs =
    document.querySelectorAll(".avatar-tab");

const headerUser =
    document.getElementById("header-user");

const headerAvatar =
    document.getElementById("header-avatar");

const headerUsername =
    document.getElementById("header-username");

const logoutButton =
    document.getElementById("logout-button");

const profileAvatar =
    document.getElementById("profile-avatar");

const profileName =
    document.getElementById("profile-name");

const profileAge =
    document.getElementById("profile-age");

const messagesContainer =
    document.getElementById("messages");

const messageForm =
    document.getElementById("message-form");

const messageInput =
    document.getElementById("message-input");

const sendButton =
    document.getElementById("send-button");

const connectionDot =
    document.getElementById("connection-dot");

const connectionText =
    document.getElementById("connection-text");


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    setupAvatarTabs();

    setupMessageInput();

    await checkCurrentUser();

});


// ============================================================
// CHECK CURRENT USER
// ============================================================

async function checkCurrentUser() {

    try {

        const response = await fetch("/api/me");

        const data = await response.json();

        if (data.authenticated) {

            state.user = data.user;

            showForum();

            await loadMessages();

            connectWebSocket();

        } else {

            showAuth();

        }

    } catch (error) {

        console.error("Could not check session:", error);

        showAuth();

    }

}


// ============================================================
// SHOW AUTH
// ============================================================

function showAuth() {

    authScreen.classList.remove("hidden");

    forumScreen.classList.add("hidden");

    headerUser.classList.add("hidden");

}


// ============================================================
// SHOW FORUM
// ============================================================

function showForum() {

    authScreen.classList.add("hidden");

    forumScreen.classList.remove("hidden");

    headerUser.classList.remove("hidden");

    updateProfile();

}


// ============================================================
// PROFILE
// ============================================================

function updateProfile() {
    if (!state.user) {
        return;
    }

    profileName.textContent =
        state.user.username;

    profileAge.textContent =
        `Age: ${state.user.age}`;

    headerUsername.textContent =
        state.user.username;

    let avatar;

    if (state.user.avatar) {
        avatar = getAvatarUrl(state.user.avatar);
    } else if (state.user.avatar_url) {
        avatar = state.user.avatar_url;
    } else if (state.user.avatar_file_id) {
        avatar = `/api/avatar/${state.user.avatar_file_id}`;
    } else {
        avatar = createDefaultAvatar();
    }

    profileAvatar.src = avatar;
    headerAvatar.src = avatar;
}

// ============================================================
// LOCATION
// ============================================================

async function enableLocation() {
    if (!state.user) {
        return;
    }

    // --------------------------------------------------------
    // TRY BROWSER GEOLOCATION FIRST
    // --------------------------------------------------------

    if ("geolocation" in navigator) {
        try {
            const position = await getBrowserLocation();

            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            await saveLocation(
                true,
                latitude,
                longitude
            );

            console.log(
                "Location enabled using browser GPS."
            );

            return;

        } catch (error) {
            console.warn(
                "Browser geolocation unavailable:",
                error
            );
        }
    }

    // --------------------------------------------------------
    // IP FALLBACK
    // --------------------------------------------------------

    try {
        await enableLocationFromIP();

        console.log(
            "Location enabled using IP fallback."
        );

    } catch (error) {
        console.error(
            "Could not determine location:",
            error
        );

        throw error;
    }
}


// ============================================================
// BROWSER GEOLOCATION
// ============================================================

function getBrowserLocation() {
    return new Promise(
        (resolve, reject) => {

            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                    enableHighAccuracy: false,
                    timeout: 10000,
                    maximumAge: 15 * 60 * 1000,
                }
            );

        }
    );
}


// ============================================================
// SAVE GPS LOCATION
// ============================================================

async function saveLocation(
    enabled,
    latitude,
    longitude
) {
    const formData = new FormData();

    formData.append(
        "enabled",
        enabled ? "true" : "false"
    );

    if (enabled) {
        formData.append(
            "latitude",
            String(latitude)
        );

        formData.append(
            "longitude",
            String(longitude)
        );
    }

    const response = await fetch(
        "/api/profile/location",
        {
            method: "PUT",
            body: formData,
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.detail ||
            "Could not save location."
        );
    }

    state.user = data;

    updateProfile();

    return data;
}


// ============================================================
// IP FALLBACK
// ============================================================

async function enableLocationFromIP() {

    const response = await fetch(
        "https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en"
    );

    if (!response.ok) {
        throw new Error(
            "IP location request failed."
        );
    }

    const data = await response.json();

    const countryCode =
        data.countryCode;

    const countryName =
        data.countryName;

    if (
        !countryCode ||
        countryCode.length !== 2
    ) {
        throw new Error(
            "Could not determine country from IP."
        );
    }

    // --------------------------------------------------------
    // IP FALLBACK ONLY KNOWS COUNTRY
    // --------------------------------------------------------
    //
    // We don't send fake coordinates.
    // The backend receives the country directly only
    // for the fallback case.
    //
    // This will be handled by the next backend step.
    // --------------------------------------------------------

    return {
        countryCode,
        countryName,
    };
}

// ============================================================
// AVATAR URL
// ============================================================

function getAvatarUrl(avatar) {

    if (!avatar) {

        return createDefaultAvatar();

    }

    if (avatar.type === "url") {

        return avatar.value;

    }

    if (avatar.type === "file") {

        return `/api/avatar/${avatar.value}`;

    }

    return createDefaultAvatar();
}


// ============================================================
// DEFAULT AVATAR
// ============================================================

function createDefaultAvatar() {

    const svg = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="100"
            height="100"
            viewBox="0 0 100 100"
        >
            <rect
                width="100"
                height="100"
                fill="#1c2128"
            />

            <circle
                cx="50"
                cy="38"
                r="18"
                fill="#8b949e"
            />

            <path
                d="M20 90
                   C22 65 36 58 50 58
                   C64 58 78 65 80 90Z"
                fill="#8b949e"
            />
        </svg>
    `;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}


// ============================================================
// AVATAR TABS
// ============================================================

function setupAvatarTabs() {

    avatarTabs.forEach(tab => {

        tab.addEventListener("click", () => {

            const selectedTab =
                tab.dataset.tab;

            avatarTabs.forEach(item => {
                item.classList.remove("active");
            });

            tab.classList.add("active");

            if (selectedTab === "url") {

                avatarUrlContainer
                    .classList
                    .remove("hidden");

                avatarFileContainer
                    .classList
                    .add("hidden");

                avatarFile.value = "";

            } else {

                avatarFileContainer
                    .classList
                    .remove("hidden");

                avatarUrlContainer
                    .classList
                    .add("hidden");

                avatarUrl.value = "";

            }

        });

    });

}


// ============================================================
// REGISTRATION
// ============================================================

registerForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        hideRegisterError();

        registerButton.disabled = true;

        registerButton.textContent =
            "Creating account...";

        try {

            const formData =
                new FormData(registerForm);

            const response =
                await fetch(
                    "/api/register",
                    {
                        method: "POST",
                        body: formData,
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.detail ||
                    "Registration failed."
                );

            }

            state.user =
                data.user;

            showForum();

            await loadMessages();

            connectWebSocket();

        } catch (error) {

            showRegisterError(
                error.message
            );

        } finally {

            registerButton.disabled = false;

            registerButton.textContent =
                "Create Account";

        }

    }
);


// ============================================================
// REGISTER ERROR
// ============================================================

function showRegisterError(message) {

    registerError.textContent = message;

    registerError.classList.remove("hidden");

}

function hideRegisterError() {

    registerError.textContent = "";

    registerError.classList.add("hidden");

}


// ============================================================
// LOGOUT
// ============================================================

logoutButton.addEventListener(
    "click",
    async () => {

        try {

            await fetch(
                "/api/logout",
                {
                    method: "POST",
                }
            );

        } catch (error) {

            console.error(
                "Logout error:",
                error
            );

        }

        if (state.socket) {

            state.socket.close();

            state.socket = null;

        }

        state.user = null;

        state.connected = false;

        messagesContainer.innerHTML = "";

        showAuth();

    }
);


// ============================================================
// LOAD MESSAGE HISTORY
// ============================================================

async function loadMessages() {

    try {

        const response =
            await fetch("/api/messages");

        if (!response.ok) {

            throw new Error(
                "Could not load messages."
            );

        }

        const data =
            await response.json();

        messagesContainer.innerHTML = "";

        if (
            !data.messages ||
            data.messages.length === 0
        ) {

            showEmptyChat();

            return;

        }

        data.messages.forEach(
            message => {
                renderMessage(
                    message,
                    false
                );
            }
        );

        scrollToBottom();

    } catch (error) {

        console.error(
            "Message history error:",
            error
        );

    }

}


// ============================================================
// EMPTY CHAT
// ============================================================

function showEmptyChat() {

    messagesContainer.innerHTML = `
        <div class="empty-chat">
            <div>
                <div class="empty-chat-icon">💬</div>
                <h2>No messages yet</h2>
                <p>Be the first person to start the conversation.</p>
            </div>
        </div>
    `;

}


// ============================================================
// RENDER MESSAGE
// ============================================================

function renderMessage(
    message,
    scroll = true
) {

    const emptyChat =
        messagesContainer.querySelector(
            ".empty-chat"
        );

    if (emptyChat) {
        emptyChat.remove();
    }

    const wrapper =
        document.createElement("div");

    wrapper.className = "message";

    const avatar =
        document.createElement("img");

    avatar.className =
        "message-avatar";

    avatar.src =
        getAvatarUrl(message.avatar);

    avatar.alt =
        `${message.username} avatar`;

    const content =
        document.createElement("div");

    content.className =
        "message-content";

    const top =
        document.createElement("div");

    top.className =
        "message-top";

    const name =
        document.createElement("span");

    name.className =
        "message-name";

    name.textContent =
        message.username;

    const time =
        document.createElement("span");

    time.className =
        "message-time";

    time.textContent =
        formatMessageTime(
            message.created_at
        );

    const text =
        document.createElement("div");

    text.className =
        "message-text";

    // textContent is intentionally used instead of innerHTML
    // to prevent HTML injection through chat messages.
    text.textContent =
        message.text;

    top.appendChild(name);

    top.appendChild(time);

    content.appendChild(top);

    content.appendChild(text);

    wrapper.appendChild(avatar);

    wrapper.appendChild(content);

    messagesContainer.appendChild(wrapper);

    if (scroll) {
        scrollToBottom();
    }

}


// ============================================================
// FORMAT TIME
// ============================================================

function formatMessageTime(
    isoDate
) {

    try {

        const date =
            new Date(isoDate);

        return date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit",
            }
        );

    } catch {

        return "";

    }

}


// ============================================================
// SCROLL
// ============================================================

function scrollToBottom() {

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;

}


// ============================================================
// WEBSOCKET
// ============================================================

function connectWebSocket() {

    if (!state.user) {
        return;
    }

    if (
        state.socket &&
        (
            state.socket.readyState ===
            WebSocket.OPEN
            ||
            state.socket.readyState ===
            WebSocket.CONNECTING
        )
    ) {

        return;

    }

    const protocol =
        location.protocol === "https:"
            ? "wss:"
            : "ws:";

    const wsUrl =
        `${protocol}//${location.host}/ws`;

    const socket =
        new WebSocket(wsUrl);

    state.socket = socket;


    socket.addEventListener(
        "open",
        () => {

            state.connected = true;

            updateConnectionStatus();

            console.log(
                "WebSocket connected."
            );

        }
    );


    socket.addEventListener(
        "message",
        event => {

            try {

                const data =
                    JSON.parse(event.data);

                if (
                    data.type ===
                    "message"
                ) {

                    renderMessage(data);

                }

                if (
                    data.type ===
                    "error"
                ) {

                    console.error(
                        data.message
                    );

                }

            } catch (error) {

                console.error(
                    "WebSocket message error:",
                    error
                );

            }

        }
    );


    socket.addEventListener(
        "close",
        () => {

            state.connected = false;

            updateConnectionStatus();

            console.log(
                "WebSocket disconnected."
            );

            scheduleReconnect();

        }
    );


    socket.addEventListener(
        "error",
        error => {

            console.error(
                "WebSocket error:",
                error
            );

        }
    );

}


// ============================================================
// RECONNECT
// ============================================================

function scheduleReconnect() {

    if (!state.user) {
        return;
    }

    if (state.reconnectTimer) {
        return;
    }

    state.reconnectTimer =
        setTimeout(
            () => {

                state.reconnectTimer =
                    null;

                connectWebSocket();

            },
            3000
        );

}


// ============================================================
// CONNECTION STATUS
// ============================================================

function updateConnectionStatus() {

    if (state.connected) {

        connectionDot.classList
            .remove("offline");

        connectionDot.classList
            .add("online");

        connectionText.textContent =
            "Connected";

    } else {

        connectionDot.classList
            .remove("online");

        connectionDot.classList
            .add("offline");

        connectionText.textContent =
            "Connecting...";

    }

}


// ============================================================
// SEND MESSAGE
// ============================================================

messageForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();

        sendMessage();

    }
);


function sendMessage() {

    const text =
        messageInput.value.trim();

    if (!text) {
        return;
    }

    if (
        !state.socket ||
        state.socket.readyState !==
        WebSocket.OPEN
    ) {

        return;

    }

    state.socket.send(
        JSON.stringify(
            {
                type: "message",
                text: text,
            }
        )
    );

    messageInput.value = "";

    autoResizeTextarea();

    messageInput.focus();

}


// ============================================================
// MESSAGE INPUT
// ============================================================

function setupMessageInput() {

    messageInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();

            }

        }
    );


    messageInput.addEventListener(
        "input",
        autoResizeTextarea
    );

}


function autoResizeTextarea() {

    messageInput.style.height =
        "auto";

    messageInput.style.height =
        Math.min(
            messageInput.scrollHeight,
            140
        ) + "px";

}
