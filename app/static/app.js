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


    // ========================================================
    // AVATAR URL
    // ========================================================

    let avatar;

    if (state.user.avatar) {

        avatar =
            getAvatarUrl(
                state.user.avatar
            );

    } else if (state.user.avatar_url) {

        avatar =
            state.user.avatar_url;

    } else if (state.user.avatar_file_id) {

        avatar =
            `/api/avatar/${state.user.avatar_file_id}`;

    } else {

        avatar =
            createDefaultAvatar();
    }


    // ========================================================
    // PROFILE AVATAR
    // ========================================================

    if (profileAvatar) {

        profileAvatar.src =
            avatar;
    }


    // ========================================================
    // HEADER AVATAR
    // ========================================================

    if (headerAvatar) {

        headerAvatar.src =
            avatar;
    }


    // ========================================================
    // AVATAR DECORATION
    // ========================================================

    const profileAvatarContainer =
        document.getElementById(
            "profile-avatar-container"
        );

    const headerAvatarContainer =
        document.getElementById(
            "header-avatar-container"
        );


    if (
        profileAvatarContainer &&
        profileAvatar
    ) {

        const existingDecoration =
            profileAvatarContainer.querySelector(
                ".avatar-decoration"
            );

        if (existingDecoration) {

            existingDecoration.remove();
        }


        if (
            state.user.avatar_decoration
        ) {

            const decoration =
                document.createElement(
                    "img"
                );

            decoration.className =
                "avatar-decoration";

            decoration.src =
                `/static/decorations/${encodeURIComponent(
                    state.user.avatar_decoration
                )}.webp`;

            decoration.alt =
                "";

            decoration.setAttribute(
                "aria-hidden",
                "true"
            );

            decoration.draggable =
                false;

            profileAvatarContainer.appendChild(
                decoration
            );
        }
    }


    if (
        headerAvatarContainer &&
        headerAvatar
    ) {

        const existingDecoration =
            headerAvatarContainer.querySelector(
                ".avatar-decoration"
            );

        if (existingDecoration) {

            existingDecoration.remove();
        }


        if (
            state.user.avatar_decoration
        ) {

            const decoration =
                document.createElement(
                    "img"
                );

            decoration.className =
                "avatar-decoration";

            decoration.src =
                `/static/decorations/${encodeURIComponent(
                    state.user.avatar_decoration
                )}.webp`;

            decoration.alt =
                "";

            decoration.setAttribute(
                "aria-hidden",
                "true"
            );

            decoration.draggable =
                false;

            headerAvatarContainer.appendChild(
                decoration
            );
        }
    }
}

// ============================================================
// OPEN SETTINGS
// ============================================================

function openProfileSettings() {

    if (!state.user) {
        return;
    }

    if (!profileSettings) {
        return;
    }


    // --------------------------------------------------------
    // NAME
    // --------------------------------------------------------

    if (settingsUsername) {

        settingsUsername.value =
            state.user.username || "";
    }


    // --------------------------------------------------------
    // AGE
    // --------------------------------------------------------

    if (settingsAge) {

        settingsAge.value =
            state.user.age ?? "";
    }


    // --------------------------------------------------------
    // AVATAR URL
    // --------------------------------------------------------

    if (settingsAvatarUrl) {

        if (
            state.user.avatar &&
            state.user.avatar.type === "url"
        ) {

            settingsAvatarUrl.value =
                state.user.avatar.value || "";

        } else if (
            state.user.avatar_url
        ) {

            settingsAvatarUrl.value =
                state.user.avatar_url;

        } else {

            settingsAvatarUrl.value =
                "";
        }
    }


    // --------------------------------------------------------
    // AVATAR FILE
    // --------------------------------------------------------

    if (settingsAvatarFile) {
        settingsAvatarFile.value = "";
    }

    // --------------------------------------------------------
    // AVATAR DECORATION
    // --------------------------------------------------------

    const decorationOptions =
        document.querySelectorAll(
            ".profile-decoration-option"
        );

    const currentDecoration =
        state.user.avatar_decoration || "";

    decorationOptions.forEach(
        (option) => {

            const decorationId =
                option.dataset.decorationId || "";

            option.classList.toggle(
                "selected",
                decorationId === currentDecoration
            );
        }
    );

    // --------------------------------------------------------
    // LOCATION
    // --------------------------------------------------------

    if (locationToggle) {

        locationToggle.checked =
            Boolean(
                state.user.location_enabled
            );
    }

    updateLocationDescription();


    // --------------------------------------------------------
    // RESET ERROR
    // --------------------------------------------------------

    if (profileSettingsError) {

        profileSettingsError.textContent =
            "";

        profileSettingsError.classList.add(
            "hidden"
        );
    }


    // --------------------------------------------------------
    // SHOW SETTINGS
    // --------------------------------------------------------

    profileSettings.classList.remove(
        "hidden"
    );
}

// ============================================================
// AVATAR DECORATION SELECTOR
// ============================================================

document.addEventListener(
    "click",
    (event) => {

        const option =
            event.target.closest(
                ".profile-decoration-option"
            );

        if (!option) {
            return;
        }

        const options =
            document.querySelectorAll(
                ".profile-decoration-option"
            );

        options.forEach(
            (item) => {
                item.classList.remove(
                    "selected"
                );
            }
        );

        option.classList.add(
            "selected"
        );
    }
);

// ============================================================
// LOCATION DESCRIPTION
// ============================================================

function updateLocationDescription() {

    if (!locationSettingsDescription) {
        return;
    }

    if (
        locationToggle &&
        locationToggle.checked
    ) {

        locationSettingsDescription.textContent =
            "Your country will be shown on your profile.";

    } else {

        locationSettingsDescription.textContent =
            "Your country is hidden from your profile.";
    }
}


// ============================================================
// AVATAR TAB SWITCHING
// ============================================================

settingsAvatarTabs.forEach(
    (tab) => {

        tab.addEventListener(
            "click",
            () => {

                const selectedTab =
                    tab.dataset.settingsTab;


                // Remove active state
                // from all tabs.

                settingsAvatarTabs.forEach(
                    (item) => {

                        item.classList.remove(
                            "active"
                        );
                    }
                );


                // Activate selected tab.

                tab.classList.add(
                    "active"
                );


                // Show selected container.

                if (
                    selectedTab === "url"
                ) {

                    settingsAvatarUrlContainer
                        ?.classList.remove(
                            "hidden"
                        );

                    settingsAvatarFileContainer
                        ?.classList.add(
                            "hidden"
                        );

                } else {

                    settingsAvatarUrlContainer
                        ?.classList.add(
                            "hidden"
                        );

                    settingsAvatarFileContainer
                        ?.classList.remove(
                            "hidden"
                        );
                }
            }
        );

    }
);


// ============================================================
// LOCATION TOGGLE
// ============================================================

if (locationToggle) {

    locationToggle.addEventListener(
        "change",
        async () => {

            updateLocationDescription();

            // ------------------------------------------------
            // LOCATION ENABLED
            // ------------------------------------------------

            if (locationToggle.checked) {

                try {

                    locationToggle.disabled =
                        true;

                    await enableLocation();

                } catch (error) {

                    console.error(
                        "Location activation failed:",
                        error
                    );

                    // If location could not be determined,
                    // return the switch to OFF.

                    locationToggle.checked =
                        false;

                    updateLocationDescription();

                    showProfileSettingsError(
                        error.message ||
                        "Could not determine your country."
                    );

                } finally {

                    locationToggle.disabled =
                        false;
                }

                return;
            }


            // ------------------------------------------------
            // LOCATION DISABLED
            // ------------------------------------------------

            try {

                locationToggle.disabled =
                    true;

                await saveLocation(
                    false
                );

            } catch (error) {

                console.error(
                    "Could not disable location:",
                    error
                );

                // Restore previous state
                // if the server request failed.

                locationToggle.checked =
                    true;

                updateLocationDescription();

                showProfileSettingsError(
                    error.message ||
                    "Could not disable location."
                );

            } finally {

                locationToggle.disabled =
                    false;
            }

        }
    );
}

// ============================================================
// PROFILE SETTINGS BUTTON
// ============================================================

if (profileSettingsButton) {

    profileSettingsButton.addEventListener(
        "click",
        () => {

            openProfileSettings();

        }
    );
}


// ============================================================
// SHOW SETTINGS ERROR
// ============================================================

function showProfileSettingsError(
    message
) {

    if (!profileSettingsError) {
        return;
    }

    profileSettingsError.textContent =
        message || "Something went wrong.";

    profileSettingsError.classList.remove(
        "hidden"
    );
}


// ============================================================
// SAVE PROFILE
// ============================================================

async function saveProfileChanges() {

    if (!state.user) {
        return;
    }


    if (profileSettingsError) {

        profileSettingsError.textContent =
            "";

        profileSettingsError.classList.add(
            "hidden"
        );
    }


    const username =
        settingsUsername
            ? settingsUsername.value.trim()
            : "";

    const age =
        settingsAge
            ? settingsAge.value
            : "";


    if (!username) {

        showProfileSettingsError(
            "Name is required."
        );

        return;
    }


    if (!age) {

        showProfileSettingsError(
            "Age is required."
        );

        return;
    }


    const formData =
        new FormData();

    formData.append(
        "username",
        username
    );

    formData.append(
        "age",
        age
    );
    
    
    // --------------------------------------------------------
    // AVATAR DECORATION
    // --------------------------------------------------------
    
    const selectedDecoration =
        document.querySelector(
            ".profile-decoration-option.selected"
        );
    
    const decorationId =
        selectedDecoration
            ? selectedDecoration.dataset.decorationId
            : "";
    
    formData.append(
        "avatar_decoration",
        decorationId
    );
    
    
    // --------------------------------------------------------
    // AVATAR
    // --------------------------------------------------------

    const activeAvatarTab =
        document.querySelector(
            ".settings-avatar-tab.active"
        );

    const avatarMode =
        activeAvatarTab
            ? activeAvatarTab.dataset.settingsTab
            : "url";


    if (
        avatarMode === "url"
    ) {

        const avatarUrl =
            settingsAvatarUrl
                ? settingsAvatarUrl.value.trim()
                : "";

        if (avatarUrl) {

            formData.append(
                "avatar_url",
                avatarUrl
            );
        }

    } else {

        if (
            settingsAvatarFile &&
            settingsAvatarFile.files.length > 0
        ) {

            formData.append(
                "avatar_file",
                settingsAvatarFile.files[0]
            );
        }
    }


    // --------------------------------------------------------
    // DISABLE BUTTON
    // --------------------------------------------------------

    saveProfileButton.disabled =
        true;

    saveProfileButton.textContent =
        "Saving...";


    try {

        const response =
            await fetch(
                "/api/profile",
                {
                    method: "PUT",
                    body: formData,
                }
            );

        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail ||
                "Could not save profile."
            );
        }


        // Update local user.

        state.user =
            data;


        // Update header/sidebar.

        updateProfile();


        // Update currently opened profile.

        renderPublicUserProfile(
            data
        );


        // Update settings fields.

        openProfileSettings();


        // Keep settings open
        // because the user may want
        // to change location next.

        console.log(
            "Profile saved successfully."
        );


    } catch (error) {

        console.error(
            "Profile save error:",
            error
        );

        showProfileSettingsError(
            error.message
        );

    } finally {

        saveProfileButton.disabled =
            false;

        saveProfileButton.textContent =
            "Save Changes";
    }
}


// ============================================================
// SAVE PROFILE BUTTON
// ============================================================

if (saveProfileButton) {

    saveProfileButton.addEventListener(
        "click",
        saveProfileChanges
    );
}


// ============================================================
// ENABLE LOCATION
// ============================================================

async function enableLocation() {
    if (!state.user) {
        return;
    }

    /*
     * STEP 1:
     * Try browser GPS.
     */
    if ("geolocation" in navigator) {
        try {
            const position =
                await getBrowserLocation();

            const latitude =
                position.coords.latitude;

            const longitude =
                position.coords.longitude;

            console.log(
                "GPS coordinates received:",
                latitude,
                longitude
            );

            /*
             * STEP 2:
             * Ask BigDataCloud directly from the browser.
             */
            const url =
                "https://api.bigdatacloud.net/data/reverse-geocode-client"
                + `?latitude=${encodeURIComponent(latitude)}`
                + `&longitude=${encodeURIComponent(longitude)}`
                + "&localityLanguage=en";

            console.log(
                "Calling BigDataCloud:",
                url
            );

            const response =
                await fetch(url);

            console.log(
                "BigDataCloud HTTP status:",
                response.status
            );

            const data =
                await response.json();

            console.log(
                "BigDataCloud data:",
                data
            );

            if (!response.ok) {
                throw new Error(
                    `BigDataCloud returned HTTP ${response.status}`
                );
            }

            const countryCode =
                data.countryCode;

            const countryName =
                data.countryName;

            let displayCountryCode =
                countryCode;
            
            let displayCountryName =
                countryName;
            
            let countryWasRemapped =
                false;
            
            if (countryCode === "PS") {
                displayCountryCode = "IL";
                displayCountryName = "Israel";
                countryWasRemapped = true;
            }

            console.log(
                "Detected country:",
                countryCode,
                countryName
            );

            if (!countryCode) {
                throw new Error(
                    "BigDataCloud returned no countryCode."
                );
            }

            /*
             * STEP 3:
             * Send ONLY country information
             * to our backend.
             */
            await saveLocation(
                true,
                countryCode,
                countryName,
                displayCountryCode,
                displayCountryName,
                countryWasRemapped
            );

            console.log(
                "Location enabled using GPS."
            );

            return;

        } catch (error) {

            console.error(
                "GPS geolocation failed:",
                error
            );
        }
    }

    /*
     * STEP 4:
     * IP fallback.
     */
    try {

        console.log(
            "Trying BigDataCloud IP geolocation..."
        );

        const response =
            await fetch(
                "https://api.bigdatacloud.net/data/reverse-geocode-client"
                + "?localityLanguage=en"
            );

        console.log(
            "BigDataCloud IP HTTP status:",
            response.status
        );

        const data =
            await response.json();

        console.log(
            "BigDataCloud IP data:",
            data
        );

        if (!response.ok) {
            throw new Error(
                `BigDataCloud IP returned HTTP ${response.status}`
            );
        }

        if (!data.countryCode) {
            throw new Error(
                "BigDataCloud IP returned no countryCode."
            );
        }

        await saveLocation(
            true,
            data.countryCode,
            data.countryName
        );

        console.log(
            "Location enabled using IP."
        );

    } catch (error) {

        console.error(
            "IP geolocation failed:",
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

                    maximumAge:
                        15 * 60 * 1000,
                }
            );

        }
    );
}


// ============================================================
// SAVE LOCATION
// ============================================================

async function saveLocation(
    enabled,
    countryCode,
    countryName
) {
    const formData =
        new FormData();

    formData.append(
        "enabled",
        enabled
            ? "true"
            : "false"
    );

    if (
        enabled &&
        countryCode
    ) {
        formData.append(
            "country_code",
            countryCode
        );

        formData.append(
            "country_name",
            countryName || countryCode
        );
    }

    console.log(
        "FORM DATA BEFORE SEND:",
        {
            enabled: formData.get("enabled"),
            country_code:
                formData.get("country_code"),
            country_name:
                formData.get("country_name")
        }
    );

    const response =
        await fetch(
            "/api/profile/location",
            {
                method: "PUT",
                body: formData,
            }
        );

    const data =
        await response.json();

    if (!response.ok) {
        throw new Error(
            data.detail ||
            "Could not save location."
        );
    }

    state.user =
        data;

    updateProfile();

    renderPublicUserProfile(
        data
    );

    if (locationToggle) {
        locationToggle.checked =
            Boolean(
                data.location_enabled
            );
    }

    updateLocationDescription();

    return data;
}

// ============================================================
// OPEN PROFILE
// ============================================================

async function openUserProfile(userId) {

    if (!userId) {
        return;
    }

    if (!userProfilePanel) {
        return;
    }

    try {

        userProfilePanel.classList.add("open");

        const response = await fetch(
            `/api/users/${encodeURIComponent(userId)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail ||
                "Could not load user profile."
            );
        }

        renderPublicUserProfile(data);

    } catch (error) {

        console.error(
            "Could not load user profile:",
            error
        );
    }
}


// ============================================================
// RENDER PUBLIC PROFILE
// ============================================================

function renderPublicUserProfile(profile) {

    if (!profile) {
        return;
    }


    // --------------------------------------------------------
    // NAME
    // --------------------------------------------------------

    if (publicProfileName) {

        publicProfileName.textContent =
            profile.username || "User";
    }


    // --------------------------------------------------------
    // AGE
    // --------------------------------------------------------

    if (publicProfileAge) {

        if (
            profile.age !== null &&
            profile.age !== undefined
        ) {

            publicProfileAge.textContent =
                `Age: ${profile.age}`;

        } else {

            publicProfileAge.textContent =
                "Age: —";
        }
    }


    // --------------------------------------------------------
    // COUNTRY
    // --------------------------------------------------------

    if (profileCountryFlag) {

        if (
            profile.location_enabled &&
            profile.country_code
        ) {
            let flagCountryCode =
                profile.country_code.toLowerCase();
            
            if (flagCountryCode === "ps") {
                flagCountryCode = "il";
            }
            
            profileCountryFlag.src =
                `https://flagcdn.com/w160/${flagCountryCode}.png`;
        
            profileCountryFlag.alt =
                `${profile.country_name || profile.country_code} flag`;
        } else {
            profileCountryFlag.src =
                "https://twemoji.maxcdn.com/v/latest/72x72/1f310.png";
        
            profileCountryFlag.alt =
                "Location hidden";
        
            profileCountryFlag.classList.add(
                "profile-global-icon"
            );
        }
    }

    if (publicProfileCountry) {
    
        if (
            profile.location_enabled &&
            profile.country_code
        ) {
    
            if (profile.country_code === "PS") {
    
                publicProfileCountry.textContent =
                    "🇮🇱 IL — Israel";
    
            } else {
    
                publicProfileCountry.textContent =
                    `${profile.country_flag || "🌐"} ${profile.country_code} — ${profile.country_name}`;
            }
    
        } else {
    
            publicProfileCountry.textContent =
                "Location hidden";
        }
    }


    // --------------------------------------------------------
    // REGISTRATION DATE
    // --------------------------------------------------------

    if (publicProfileRegistered) {

        if (profile.created_at) {

            const date =
                new Date(profile.created_at);

            if (!Number.isNaN(date.getTime())) {

                publicProfileRegistered.textContent =
                    `Registered: ${date.toLocaleDateString(
                        undefined,
                        {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        }
                    )}`;

            } else {

                publicProfileRegistered.textContent =
                    "Registered: —";
            }

        } else {

            publicProfileRegistered.textContent =
                "Registered: —";
        }
    }


    // --------------------------------------------------------
    // AVATAR
    // --------------------------------------------------------

    if (publicProfileAvatar) {

        let avatarUrl =
            createDefaultAvatar();

        if (profile.avatar_url) {

            avatarUrl =
                profile.avatar_url;

        } else if (profile.avatar_file_id) {

            avatarUrl =
                `/api/avatar/${encodeURIComponent(
                    profile.avatar_file_id
                )}`;

        } else if (profile.avatar) {

            avatarUrl =
                getAvatarUrl(profile.avatar);
        }

        publicProfileAvatar.src =
            avatarUrl;
        
        
        applyAvatarDecoration(
            publicProfileAvatar,
            profile.avatar_decoration
        );
    }


    // --------------------------------------------------------
    // SETTINGS BUTTON
    // --------------------------------------------------------

    if (profileSettingsButton) {

        if (
            state.user &&
            profile.id === state.user.id
        ) {

            profileSettingsButton.classList.remove(
                "hidden"
            );

        } else {

            profileSettingsButton.classList.add(
                "hidden"
            );
        }
    }


    // --------------------------------------------------------
    // SETTINGS PANEL
    // --------------------------------------------------------

    if (profileSettings) {

        profileSettings.classList.add(
            "hidden"
        );
    }
}


// ============================================================
// CLOSE PROFILE
// ============================================================

function closeUserProfile() {

    if (!userProfilePanel) {
        return;
    }

    userProfilePanel.classList.remove(
        "open"
    );

    if (profileSettings) {

        profileSettings.classList.add(
            "hidden"
        );
    }
}


// ============================================================
// CLOSE BUTTON
// ============================================================

if (closeProfilePanelButton) {

    closeProfilePanelButton.addEventListener(
        "click",
        closeUserProfile
    );
}

// ============================================================
// LOCATION
// ============================================================




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
// AVATAR WITH DECORATION
// ============================================================

function createAvatarWithDecoration(
    avatarUrl,
    decorationId,
    className = ""
) {

    const container =
        document.createElement("div");

    container.className =
        `avatar-decoration-container ${className}`.trim();


    // --------------------------------------------------------
    // AVATAR
    // --------------------------------------------------------

    const avatar =
        document.createElement("img");

    avatar.className =
        "avatar-image";

    avatar.src =
        avatarUrl || createDefaultAvatar();

    avatar.alt =
        "Avatar";


    container.appendChild(
        avatar
    );


    // --------------------------------------------------------
    // DECORATION
    // --------------------------------------------------------

    if (decorationId) {

        const decoration =
            document.createElement("img");

        decoration.className =
            "avatar-decoration";

        decoration.src =
            `/static/decorations/${decorationId}.webp`;

        decoration.alt =
            "";

        decoration.setAttribute(
            "aria-hidden",
            "true"
        );

        decoration.draggable =
            false;

        container.appendChild(
            decoration
        );
    }


    return container;
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
// AVATAR DECORATION RENDERER
// ============================================================

function applyAvatarDecoration(
    avatarElement,
    decorationId
) {

    if (!avatarElement) {
        return;
    }


    const wrapper =
        avatarElement.parentElement;


    if (!wrapper) {
        return;
    }


    // --------------------------------------------------------
    // REMOVE OLD DECORATION
    // --------------------------------------------------------

    const oldDecoration =
        wrapper.querySelector(
            ".avatar-decoration"
        );


    if (oldDecoration) {

        oldDecoration.remove();
    }


    // --------------------------------------------------------
    // NO DECORATION
    // --------------------------------------------------------

    if (!decorationId) {
        return;
    }


    // --------------------------------------------------------
    // CREATE DECORATION
    // --------------------------------------------------------

    const decoration =
        document.createElement(
            "img"
        );


    decoration.className =
        "avatar-decoration";


    decoration.src =
        `/static/decorations/${encodeURIComponent(
            decorationId
        )}.webp`;


    decoration.alt =
        "";


    decoration.setAttribute(
        "aria-hidden",
        "true"
    );


    // --------------------------------------------------------
    // ADD TO AVATAR WRAPPER
    // --------------------------------------------------------

    wrapper.appendChild(
        decoration
    );
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

    wrapper.className =
        "message";


    // ========================================================
    // AVATAR
    // ========================================================

    const avatarContainer =
        createAvatarWithDecoration(
            getAvatarUrl(message.avatar),
            message.avatar_decoration,
            "message-avatar-wrapper"
        );


    // --------------------------------------------------------
    // MAKE AVATAR CLICKABLE
    // --------------------------------------------------------

    if (message.user_id) {

        avatarContainer.style.cursor =
            "pointer";

        avatarContainer.addEventListener(
            "click",
            () => {

                openUserProfile(
                    message.user_id
                );
            }
        );
    }


    // ========================================================
    // MESSAGE CONTENT
    // ========================================================

    const content =
        document.createElement("div");

    content.className =
        "message-content";

    const top =
        document.createElement("div");

    top.className =
        "message-top";


    // ========================================================
    // USERNAME
    // ========================================================

    const name =
        document.createElement("span");

    name.className =
        "message-name";

    name.textContent =
        message.username;


    // ========================================================
    // TIME
    // ========================================================

    const time =
        document.createElement("span");

    time.className =
        "message-time";

    time.textContent =
        formatMessageTime(
            message.created_at
        );


    // ========================================================
    // MESSAGE TEXT
    // ========================================================

    const text =
        document.createElement("div");

    text.className =
        "message-text";

    // textContent is intentionally used instead of innerHTML
    // to prevent HTML injection through chat messages.

    text.textContent =
        message.text;


    // ========================================================
    // BUILD MESSAGE
    // ========================================================

    top.appendChild(name);

    top.appendChild(time);

    content.appendChild(top);

    content.appendChild(text);

    wrapper.appendChild(
        avatarContainer
    );

    wrapper.appendChild(
        content
    );

    messagesContainer.appendChild(
        wrapper
    );


    // ========================================================
    // SCROLL
    // ========================================================

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
