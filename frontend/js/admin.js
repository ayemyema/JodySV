const API_URL = "http://localhost:8080";


// =========================
// ELEMENTS
// =========================

const uploadForm = document.getElementById("uploadForm");

const imageInput = document.getElementById("image");

const categoryInput = document.getElementById("category");

const previewContainer =
    document.getElementById("previewContainer");

const preview =
    document.getElementById("preview");

const uploadButton =
    document.getElementById("uploadButton");

const message =
    document.getElementById("message");

const gallery =
    document.getElementById("gallery");

const galleryCategory =
    document.getElementById("galleryCategory");

const refreshButton =
    document.getElementById("refreshButton");


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

    if (file.size > 10 * 1024 * 1024) {

        showMessage(
            "The image is too large. Maximum size is 10 MB.",
            "error"
        );

        imageInput.value = "";

        previewContainer.style.display = "none";

        return;
    }


    const imageURL =
        URL.createObjectURL(file);

    preview.src = imageURL;

    previewContainer.style.display = "block";

    clearMessage();
});


// =========================
// UPLOAD
// =========================

uploadForm.addEventListener("submit", async (event) => {

    event.preventDefault();


    const file = imageInput.files[0];

    const category =
        categoryInput.value;


    if (!file) {

        showMessage(
            "Please choose an image.",
            "error"
        );

        return;
    }


    const formData = new FormData();

    formData.append("image", file);

    formData.append("category", category);


    uploadButton.disabled = true;

    uploadButton.textContent =
        "Uploading...";

    clearMessage();


    try {

        const response =
            await fetch(
                `${API_URL}/api/images/upload?category=${encodeURIComponent(category)}`,
                {
                    method: "POST",
                    body: formData
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.message ||
                "Upload failed."
            );
        }


        showMessage(
            "Picture uploaded successfully!",
            "success"
        );


        uploadForm.reset();

        previewContainer.style.display =
            "none";


        loadImages();


    } catch (error) {

        console.error(error);

        showMessage(
            error.message ||
            "Could not connect to the Java server.",
            "error"
        );

    } finally {

        uploadButton.disabled = false;

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

        const response =
            await fetch(
                `${API_URL}/api/images?category=${encodeURIComponent(category)}`
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.message ||
                "Could not load images."
            );
        }


        displayImages(
            result.images,
            category
        );


    } catch (error) {

        console.error(error);

        gallery.innerHTML = `
            <p class="empty">
                Could not connect to the Java backend.
                Make sure Spring Boot is running on port 8080.
            </p>
        `;
    }
}


// =========================
// DISPLAY IMAGES
// =========================

function displayImages(images, category) {

    gallery.innerHTML = "";


    if (!images || images.length === 0) {

        gallery.innerHTML = `
            <p class="empty">
                No pictures uploaded for this category yet.
            </p>
        `;

        return;
    }


    images.forEach(filename => {

        const card =
            document.createElement("div");

        card.className =
            "image-card";


        const img =
            document.createElement("img");

        img.src =
            `${API_URL}/uploads/${encodeURIComponent(category)}/${encodeURIComponent(filename)}`;

        img.alt =
            "Uploaded event picture";


        const info =
            document.createElement("div");

        info.className =
            "image-info";


        const name =
            document.createElement("div");

        name.className =
            "image-name";

        name.textContent =
            filename;


        const deleteButton =
            document.createElement("button");

        deleteButton.className =
            "delete-button";

        deleteButton.textContent =
            "Delete";


        deleteButton.addEventListener(
            "click",
            () => deleteImage(category, filename)
        );


        info.appendChild(name);

        info.appendChild(deleteButton);

        card.appendChild(img);

        card.appendChild(info);

        gallery.appendChild(card);

    });
}


// =========================
// DELETE IMAGE
// =========================

async function deleteImage(category, filename) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this picture?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/api/images?category=${encodeURIComponent(category)}&filename=${encodeURIComponent(filename)}`,
                {
                    method: "DELETE"
                }
            );


        const result =
            await response.json();


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

        console.error(error);

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
    loadImages
);


// =========================
// MESSAGE
// =========================

function showMessage(text, type) {

    message.textContent = text;

    message.className = type;
}


function clearMessage() {

    message.textContent = "";

    message.className = "";
}


// =========================
// CAPITALIZE
// =========================

function capitalize(text) {

    return text.charAt(0).toUpperCase()
        + text.slice(1);
}


// =========================
// INITIAL LOAD
// =========================

loadImages();
