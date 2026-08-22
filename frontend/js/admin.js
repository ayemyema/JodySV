const API_URL = "https://redesigned-goggles-7v7jj6p4prw3jgg.github.dev";

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
// UPLOAD IMAGE
// =========================

uploadForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const file =
        imageInput.files[0];

    const category =
        categoryInput.value;


    // Check image
    if (!file) {

        showMessage(
            "Please choose an image.",
            "error"
        );

        return;
    }


    // Check category
    if (!category) {

        showMessage(
            "Please select a category.",
            "error"
        );

        return;
    }


    // Create FormData
    const formData =
        new FormData();

    formData.append(
        "image",
        file
    );


    // Disable button
    uploadButton.disabled = true;

    uploadButton.textContent =
        "Uploading...";

    clearMessage();


    try {

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


        // Check response
        if (!response.ok) {

            throw new Error(
                result.message ||
                `Upload failed. Server returned ${response.status}.`
            );
        }


        // Success
        showMessage(
            "Picture uploaded successfully!",
            "success"
        );


        console.log(
            "Uploaded filename:",
            result.filename
        );


        // Reset form
        uploadForm.reset();


        // Hide preview
        previewContainer.style.display =
            "none";


        // Refresh gallery
        loadImages();


    } catch (error) {

        console.error(
            "UPLOAD ERROR:",
            error
        );


        showMessage(
            error.message ||
            "Failed to fetch. Make sure the Java backend is running.",
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


            // If image cannot load
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

    return text
        .charAt(0)
        .toUpperCase()
        + text.slice(1);
}


// =========================
// INITIAL LOAD
// =========================

loadImages();
