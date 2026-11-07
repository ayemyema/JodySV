const API_URL = "https://jodysv1.onrender.com";
const IMAGE_REQUEST_TIMEOUT_MS = 15000;
const IMAGE_REQUEST_RETRY_DELAYS = [
    2000,
    5000,
    10000,
    20000,
    20000,
    20000,
    20000
];

function initializeGalleryLightbox(galleryId) {
    const gallery = document.getElementById(galleryId);
    const lightbox = document.getElementById("imageLightbox");
    const lightboxImage = document.getElementById("lightboxImage");
    const closeButton = lightbox.querySelector(".image-lightbox-close");
    const previousButton = lightbox.querySelector(".image-lightbox-previous");
    const nextButton = lightbox.querySelector(".image-lightbox-next");
    let activeIndex = -1;

    if (!gallery || !lightbox || !lightboxImage ||
            !closeButton || !previousButton || !nextButton) {
        throw new Error("Could not initialize the event photo lightbox.");
    }

    const getImages = () => Array.from(
        gallery.querySelectorAll(".gallery-item img")
    ).filter(image => image.style.display !== "none");

    const showImage = index => {
        const images = getImages();

        if (images.length === 0) {
            return;
        }

        activeIndex = (index + images.length) % images.length;
        const image = images[activeIndex];
        lightboxImage.src = image.currentSrc || image.src;
        lightboxImage.alt = image.alt;
        previousButton.hidden = images.length < 2;
        nextButton.hidden = images.length < 2;
    };

    gallery.addEventListener("click", event => {
        const image = event.target.closest(".gallery-item img");

        if (!image) {
            return;
        }

        showImage(getImages().indexOf(image));
        lightbox.showModal();
    });

    previousButton.addEventListener("click", () => {
        showImage(activeIndex - 1);
    });

    nextButton.addEventListener("click", () => {
        showImage(activeIndex + 1);
    });

    closeButton.addEventListener("click", () => {
        lightbox.close();
    });

    lightbox.addEventListener("click", event => {
        if (event.target === lightbox) {
            lightbox.close();
        }
    });

    lightbox.addEventListener("keydown", event => {
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            showImage(activeIndex - 1);
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            showImage(activeIndex + 1);
        }
    });
}

async function loadUploadedPictures(category, galleryId, altText) {
    const gallery = document.getElementById(galleryId);

    if (!gallery) {
        throw new Error(`Could not find the ${category} event gallery.`);
    }

    try {
        const images = await fetchUploadedPictures(category);

        if (images.length === 0 && gallery.children.length === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.textContent = "No event photos have been uploaded yet.";
            gallery.appendChild(emptyMessage);
            return;
        }

        images.forEach(imageInfo => {
            const item = document.createElement("div");
            item.className = "gallery-item";

            const image = document.createElement("img");
            image.alt = altText;
            image.loading = "lazy";
            item.appendChild(image);
            gallery.appendChild(item);
            loadImageWithRetry(image, imageInfo.url, () => {
                console.error("Could not load image after retries:", imageInfo.url);
                image.style.display = "none";
                const message = document.createElement("p");
                message.textContent = "This picture is temporarily unavailable. Please refresh to try again.";
                item.appendChild(message);
            });
        });
    } catch (error) {
        console.error(`Could not load uploaded ${category} pictures:`, error);
    }
}

async function fetchUploadedPictures(category) {
    const url = `${API_URL}/api/images?category=${encodeURIComponent(category)}`;

    for (let attempt = 0; attempt <= IMAGE_REQUEST_RETRY_DELAYS.length; attempt++) {
        let response;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(
                () => controller.abort(),
                IMAGE_REQUEST_TIMEOUT_MS
            );

            try {
                response = await fetch(url, {
                    cache: "no-store",
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeout);
            }
        } catch (error) {
            if (attempt === IMAGE_REQUEST_RETRY_DELAYS.length) {
                throw error;
            }

            console.warn(`Retrying uploaded ${category} picture request:`, error);
            await delay(IMAGE_REQUEST_RETRY_DELAYS[attempt]);
            continue;
        }

        if (response.ok) {
            const data = await response.json();

            if (!Array.isArray(data.images)) {
                throw new Error("The image service returned an invalid image list.");
            }

            return data.images;
        }

        if (![502, 503, 504].includes(response.status) ||
                attempt === IMAGE_REQUEST_RETRY_DELAYS.length) {
            throw new Error(`Image service returned ${response.status}.`);
        }

        console.warn(
            `Retrying uploaded ${category} picture request after HTTP ${response.status}.`
        );
        await delay(IMAGE_REQUEST_RETRY_DELAYS[attempt]);
    }

    throw new Error("Could not load uploaded pictures.");
}

function delay(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}
