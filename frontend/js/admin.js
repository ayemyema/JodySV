const API_URL = "https://jodysv1.onrender.com";

// =========================
// ELEMENTS
// =========================

const loginPanel = document.getElementById("loginPanel");
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const togglePasswordButton = document.getElementById("togglePassword");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const adminContent = document.getElementById("adminContent");
const logoutButton = document.getElementById("logoutButton");

const uploadForm = document.getElementById("uploadForm");
const imageInput = document.getElementById("image");
const categoryInput = document.getElementById("category");

const previewContainer = document.getElementById("previewContainer");
const previewList = document.getElementById("previewList");

const uploadButton = document.getElementById("uploadButton");
const message = document.getElementById("message");

const gallery = document.getElementById("gallery");
const galleryCategory = document.getElementById("galleryCategory");
const refreshButton = document.getElementById("refreshButton");


// =========================
// SETTINGS
// =========================

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_UPLOAD_COUNT = 5;

// Target upload size.
// Keeping this below 2 MB gives the Codespaces proxy plenty of room.
const TARGET_SIZE = 1.5 * 1024 * 1024;

const MAX_WIDTH = 2400;
const MAX_HEIGHT = 2400;

let adminAuthorization = "";

fetch(`${API_URL}/api/health`, { cache: "no-store" })
    .catch(error => {
        console.warn("Could not warm up the admin service:", error);
    });

togglePasswordButton.addEventListener("click", () => {
    const showPassword = passwordInput.type === "password";
    passwordInput.type = showPassword ? "text" : "password";
    togglePasswordButton.textContent = showPassword ? "Hide" : "Show";
    togglePasswordButton.setAttribute("aria-pressed", String(showPassword));
});

function encodeBasicCredentials(username, password) {
    const bytes = new TextEncoder().encode(`${username}:${password}`);
    let binary = "";
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}

loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    loginButton.disabled = true;
    loginButton.textContent = "Connecting...";
    loginMessage.textContent = "";

    const credentials = encodeBasicCredentials(usernameInput.value, passwordInput.value);

    try {
        const response = await fetch(`${API_URL}/api/admin/session`, {
            headers: {
                Authorization: `Basic ${credentials}`
            },
            cache: "no-store"
        });

        if (!response.ok) {
            loginMessage.textContent = response.status === 401 || response.status === 403
                ? "The username or password is incorrect."
                : "Could not sign in. Please try again.";
            return;
        }

        adminAuthorization = `Basic ${credentials}`;
        passwordInput.value = "";
        loginPanel.hidden = true;
        adminContent.hidden = false;
        logoutButton.hidden = false;
        loadImages();
    } catch (error) {
        console.error("LOGIN ERROR:", error);
        loginMessage.textContent = "Could not connect to the admin service. If it is starting after being idle, wait a moment and try again.";
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Log in";
    }
});

logoutButton.addEventListener("click", () => {
    adminAuthorization = "";
    adminContent.hidden = true;
    loginPanel.hidden = false;
    logoutButton.hidden = true;
    loginForm.reset();
    loginMessage.textContent = "";
});

function adminRequestHeaders() {
    return {
        Authorization: adminAuthorization
    };
}

// =========================
// IMAGE PREVIEW
// =========================

imageInput.addEventListener("change", () => {
    const files = Array.from(imageInput.files);
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (files.length > MAX_UPLOAD_COUNT) {
        imageInput.value = "";
        renderImagePreviews([]);
        showMessage(`Please select no more than ${MAX_UPLOAD_COUNT} pictures at a time.`, "error");
        return;
    }

    const invalidType = files.find(file => !allowedTypes.includes(file.type));
    if (invalidType) {
        imageInput.value = "";
        renderImagePreviews([]);
        showMessage("Please select only JPG, PNG, or WEBP images.", "error");
        return;
    }

    const oversizedFile = files.find(file => file.size > MAX_FILE_SIZE);
    if (oversizedFile) {
        imageInput.value = "";
        renderImagePreviews([]);
        showMessage("Each image must be no larger than 10 MB.", "error");
        return;
    }

    renderImagePreviews(files);
    clearMessage();
});

function renderImagePreviews(files) {
    previewList.querySelectorAll("img").forEach(image => {
        URL.revokeObjectURL(image.src);
    });
    previewList.replaceChildren();

    if (files.length === 0) {
        previewContainer.style.display = "none";
        return;
    }

    files.forEach(file => {
        const item = document.createElement("div");
        item.className = "preview-item";

        const image = document.createElement("img");
        image.src = URL.createObjectURL(file);
        image.alt = file.name;

        const name = document.createElement("span");
        name.textContent = file.name;

        item.append(image, name);
        previewList.appendChild(item);
    });

    previewContainer.style.display = "block";
}

function updateSelectedFiles(remainingFiles) {
    const fileTransfer = new DataTransfer();
    remainingFiles.forEach(file => fileTransfer.items.add(file));
    imageInput.files = fileTransfer.files;
    renderImagePreviews(remainingFiles);
}


// =========================
// COMPRESS IMAGE
// =========================

async function compressImage(file) {

    // Small images don't need compression.
    if (file.size <= TARGET_SIZE) {
        return file;
    }

    showMessage(
        "Compressing image before upload...",
        "success"
    );

    const image = new Image();

    const imageURL = URL.createObjectURL(file);

    try {

        await new Promise((resolve, reject) => {

            image.onload = resolve;
            image.onerror = reject;

            image.src = imageURL;
        });

        let width = image.naturalWidth;
        let height = image.naturalHeight;

        // Resize if necessary.
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {

            const scale =
                Math.min(
                    MAX_WIDTH / width,
                    MAX_HEIGHT / height
                );

            width = Math.round(width * scale);
            height = Math.round(height * scale);
        }

        const canvas =
            document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context =
            canvas.getContext("2d");

        context.drawImage(
            image,
            0,
            0,
            width,
            height
        );

        // Start with good JPEG quality.
        let quality = 0.85;

        let blob =
            await canvasToBlob(
                canvas,
                quality
            );

        // Reduce quality until the file is small enough.
        while (
            blob.size > TARGET_SIZE &&
            quality > 0.35
        ) {

            quality -= 0.05;

            blob =
                await canvasToBlob(
                    canvas,
                    quality
                );
        }

        // If compression somehow didn't help,
        // return the original file.
        if (blob.size >= file.size) {
            return file;
        }

        const compressedFile =
            new File(
                [blob],
                getCompressedFilename(file.name),
                {
                    type: "image/jpeg",
                    lastModified: Date.now()
                }
            );

        console.log(
            "Original size:",
            formatFileSize(file.size)
        );

        console.log(
            "Compressed size:",
            formatFileSize(compressedFile.size)
        );

        return compressedFile;

    } finally {

        URL.revokeObjectURL(imageURL);
    }
}


// =========================
// CANVAS TO BLOB
// =========================

function canvasToBlob(canvas, quality) {

    return new Promise((resolve, reject) => {

        canvas.toBlob(
            blob => {

                if (blob) {
                    resolve(blob);
                } else {
                    reject(
                        new Error(
                            "Could not compress image."
                        )
                    );
                }

            },
            "image/jpeg",
            quality
        );
    });
}


// =========================
// COMPRESSED FILENAME
// =========================

function getCompressedFilename(filename) {

    const lastDot =
        filename.lastIndexOf(".");

    if (lastDot === -1) {
        return `${filename}.jpg`;
    }

    return (
        filename.substring(0, lastDot) +
        ".jpg"
    );
}


// =========================
// FORMAT FILE SIZE
// =========================

function formatFileSize(bytes) {

    if (bytes < 1024 * 1024) {

        return (
            (bytes / 1024).toFixed(0) +
            " KB"
        );
    }

    return (
        (bytes / (1024 * 1024)).toFixed(2) +
        " MB"
    );
}


// =========================
// UPLOAD IMAGE
// =========================

uploadForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const originalFiles =
        Array.from(imageInput.files);

    const category =
        categoryInput.value;

    if (originalFiles.length === 0) {

        showMessage(
            "Please choose at least one picture.",
            "error"
        );

        return;
    }

    if (originalFiles.length > MAX_UPLOAD_COUNT) {
        showMessage(`Please choose no more than ${MAX_UPLOAD_COUNT} pictures.`, "error");
        return;
    }

    if (!category) {

        showMessage(
            "Please select a category.",
            "error"
        );

        return;
    }

    uploadButton.disabled = true;

    clearMessage();

    let uploadedCount = 0;
    try {
        const uploadURL =
            `${API_URL}/api/images/upload?category=${encodeURIComponent(category)}`;

        for (const originalFile of originalFiles) {
            uploadButton.textContent = uploadedCount === 0
                ? `Preparing 1 of ${originalFiles.length}...`
                : `Preparing ${uploadedCount + 1} of ${originalFiles.length}...`;

            const file = await compressImage(originalFile);
            const formData = new FormData();
            formData.append("image", file);

            uploadButton.textContent = `Uploading ${uploadedCount + 1} of ${originalFiles.length}...`;
            const response = await fetch(uploadURL, {
                method: "POST",
                headers: adminRequestHeaders(),
                body: formData
            });
            const responseText = await response.text();

            let result = {};
            try {
                result = JSON.parse(responseText);
            } catch {
                result = { message: responseText };
            }

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    `Upload failed for ${originalFile.name}. Server returned ${response.status}.`
                );
            }

            uploadedCount += 1;
            updateSelectedFiles(originalFiles.slice(uploadedCount));
        }

        uploadForm.reset();
        renderImagePreviews([]);
        showMessage(`Successfully uploaded ${uploadedCount} pictures.`, "success");
        loadImages();
    } catch (error) {
        console.error("UPLOAD ERROR:", error);
        const messageText = uploadedCount > 0
            ? `Uploaded ${uploadedCount} picture(s). The remaining upload failed: ${error.message}`
            : error.message || "Failed to upload the pictures.";
        showMessage(messageText, "error");
        if (uploadedCount > 0) {
            loadImages();
        }

    } finally {

        uploadButton.disabled =
            false;

        uploadButton.textContent = "Upload Pictures";
    }
});


// =========================
// LOAD IMAGES
// =========================

async function loadImages() {

    const category =
        categoryInput.value;

    galleryCategory.textContent =
        capitalize(category);

    gallery.innerHTML = `
        <p class="loading">
            Loading pictures...
        </p>
    `;

    try {

        const url =
            `${API_URL}/api/images?category=${encodeURIComponent(category)}`;

        console.log(
            "Loading images from:",
            url
        );

        const response =
            await fetch(
                url,
                {
                    method: "GET"
                }
            );

        const responseText =
            await response.text();

        console.log(
            "Gallery response:",
            responseText
        );

        let result = {};

        try {

            result =
                JSON.parse(responseText);

        } catch {

            result = {
                message: responseText
            };
        }

        if (!response.ok) {

            throw new Error(
                result.message ||
                `Server returned ${response.status}.`
            );
        }

        displayImages(
            result.images || [],
            category
        );

    } catch (error) {

        console.error(
            "LOAD IMAGES ERROR:",
            error
        );

        gallery.innerHTML = `
            <p class="empty">
                Could not load pictures.
                <br>
                ${error.message}
            </p>
        `;
    }
}


// =========================
// DISPLAY IMAGES
// =========================

function displayImages(
    images,
    category
) {

    gallery.innerHTML = "";

    if (
        !images ||
        images.length === 0
    ) {

        gallery.innerHTML = `
            <p class="empty">
                No pictures uploaded for this category yet.
            </p>
        `;

        return;
    }

    images.forEach(
        imageInfo => {

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "image-card";

            const img =
                document.createElement(
                    "img"
                );

            img.src = imageInfo.url;

            img.alt =
                "Uploaded event picture";

            img.onerror = () => {

                console.error(
                    "Could not load image:",
                    img.src
                );

                img.alt =
                    "Image could not be loaded";
            };

            const info =
                document.createElement(
                    "div"
                );

            info.className =
                "image-info";

            const name =
                document.createElement(
                    "div"
                );

            name.className =
                "image-name";

            name.textContent =
                imageInfo.filename;

            const deleteButton =
                document.createElement(
                    "button"
                );

            deleteButton.className =
                "delete-button";

            deleteButton.textContent =
                "Delete";

            deleteButton.addEventListener(
                "click",
                () => {

                    deleteImage(
                        category,
                        imageInfo.filename
                    );
                }
            );

            info.appendChild(name);

            info.appendChild(
                deleteButton
            );

            card.appendChild(img);

            card.appendChild(info);

            gallery.appendChild(card);
        }
    );
}


// =========================
// DELETE IMAGE
// =========================

async function deleteImage(
    category,
    filename
) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this picture?"
        );

    if (!confirmed) {
        return;
    }

    try {

        const url =
            `${API_URL}/api/images?category=${encodeURIComponent(category)}&filename=${encodeURIComponent(filename)}`;

        const response =
            await fetch(
                url,
                {
                    method: "DELETE",
                    headers: adminRequestHeaders()
                }
            );

        const responseText =
            await response.text();

        let result = {};

        try {

            result =
                JSON.parse(responseText);

        } catch {

            result = {
                message: responseText
            };
        }

        if (!response.ok) {

            throw new Error(
                result.message ||
                "Delete failed."
            );
        }

        showMessage(
            "Picture deleted successfully.",
            "success"
        );

        loadImages();

    } catch (error) {

        console.error(
            "DELETE ERROR:",
            error
        );

        showMessage(
            error.message ||
            "Could not delete the picture.",
            "error"
        );
    }
}


// =========================
// CATEGORY CHANGE
// =========================

categoryInput.addEventListener(
    "change",
    () => {

        clearMessage();

        loadImages();
    }
);


// =========================
// REFRESH
// =========================

refreshButton.addEventListener(
    "click",
    () => {

        loadImages();
    }
);


// =========================
// MESSAGE
// =========================

function showMessage(
    text,
    type
) {

    message.textContent =
        text;

    message.className =
        type;
}


function clearMessage() {

    message.textContent =
        "";

    message.className =
        "";
}


// =========================
// CAPITALIZE
// =========================

function capitalize(text) {

    if (!text) {
        return "";
    }

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );
}
