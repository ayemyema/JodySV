const IMAGE_LOAD_RETRY_DELAYS = [1000, 3000, 7000];

function loadImageWithRetry(image, imageUrl, onFailure) {
    let attempts = 0;

    image.addEventListener("error", () => {
        if (attempts >= IMAGE_LOAD_RETRY_DELAYS.length) {
            onFailure();
            return;
        }

        const attempt = ++attempts;
        setTimeout(() => {
            const retryUrl = new URL(imageUrl, document.baseURI);
            retryUrl.searchParams.set("_retry", String(attempt));
            image.src = retryUrl.toString();
        }, IMAGE_LOAD_RETRY_DELAYS[attempt - 1]);
    });

    image.src = imageUrl;
}
