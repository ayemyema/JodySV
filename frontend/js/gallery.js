const API_URL = "https://jodysv1.onrender.com";
const IMAGE_REQUEST_RETRY_DELAYS = [2000, 5000, 10000, 20000];

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
            image.src = imageInfo.url;
            image.alt = altText;
            image.loading = "lazy";
            image.onerror = () => {
                console.error("Could not load image:", image.src);
                item.remove();
            };

            item.appendChild(image);
            gallery.appendChild(item);
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
            response = await fetch(url, { cache: "no-store" });
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
