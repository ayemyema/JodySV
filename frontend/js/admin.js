const API_URL = "https://redesigned-goggles-7v7jj6p4prw3jgg-8080.app.github.dev";

// =========================
// ELEMENTS
// =========================

const uploadForm = document.getElementById("uploadForm");
const imageInput = document.getElementById("image");
const categoryInput = document.getElementById("category");

const previewContainer = document.getElementById("previewContainer");
const preview = document.getElementById("preview");

const uploadButton = document.getElementById("uploadButton");
const message = document.getElementById("message");

const gallery = document.getElementById("gallery");
const galleryCategory = document.getElementById("galleryCategory");
const refreshButton = document.getElementById("refreshButton");


// =========================
// SETTINGS
// =========================

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Target upload size.
// Keeping this below 2 MB gives the Codespaces proxy plenty of room.
const TARGET_SIZE = 1.5 * 1024 * 1024;

const MAX_WIDTH = 2400;
const MAX_HEIGHT = 2400;


// =========================
// IMAGE PREVIEW
// =========================

imageInput.addEventListener("change", () => {

    const file = imageInput.files[0];

    if (!file) {
        previewContainer.style.display = "none";
        return;
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {

        showMessage(
            "Please select a JPG, PNG, or WEBP image.",
            "error"
        );

        imageInput.value = "";
        previewContainer.style.display = "none";

        return;
    }

    if (file.size > MAX_FILE_SIZE) {

        showMessage(
            "The image is too large. Maximum size is 10 MB.",
            "error"
        );

        imageInput.value = "";
        previewContainer.style.display = "none";

        return;
    }

    const imageURL = URL.createObjectURL(file);

    preview.src = imageURL;

    previewContainer.style.display = "block";

    clearMessage();
});


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

    const originalFile =
        imageInput.files[0];

    const category =
        categoryInput.value;

    if (!originalFile) {

        showMessage(
            "Please choose an image.",
            "error"
        );

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

    uploadButton.textContent =
        "Preparing image...";

    clearMessage();

    try {

        // Compress before sending.
        const file =
            await compressImage(
                originalFile
            );

        console.log(
            "Final upload size:",
            formatFileSize(file.size)
        );

        const formData =
            new FormData();

        formData.append(
            "image",
            file
        );

        uploadButton.textContent =
            "Uploading...";

        const uploadURL =
            `${API_URL}/api/images/upload?category=${encodeURIComponent(category)}`;

        console.log(
            "Uploading to:",
            uploadURL
        );

        const response =
            await fetch(
                uploadURL,
                {
                    method: "POST",
                    body: formData
                }
            );

        const responseText =
            await response.text();

        console.log(
            "Server response:",
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
                `Upload failed. Server returned ${response.status}.`
            );
        }

        showMessage(
            "Picture uploaded successfully!",
            "success"
        );

        console.log(
            "Uploaded filename:",
            result.filename
        );

        uploadForm.reset();

        previewContainer.style.display =
            "none";

        loadImages();

    } catch (error) {

        console.error(
            "UPLOAD ERROR:",
            error
        );

        showMessage(
            error.message ||
            "Failed to upload the picture.",
            "error"
        );

    } finally {

        uploadButton.disabled =
            false;

        uploadButton.textContent =
            "Upload Picture";
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
        filename => {

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

            img.src =
                `${API_URL}/uploads/${encodeURIComponent(category)}/${encodeURIComponent(filename)}`;

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
                filename;

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
                        filename
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
                    method: "DELETE"
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


// =========================
// INITIAL LOAD
// =========================

loadImages();
