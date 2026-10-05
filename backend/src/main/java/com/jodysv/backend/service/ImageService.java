package com.jodysv.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriComponentsBuilder;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class ImageService {

    private static final int PAGE_SIZE = 100;

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp"
    );

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            ".jpg",
            ".jpeg",
            ".png",
            ".webp"
    );

    private final String storageUrl;
    private final String bucket;
    private final String serviceRoleKey;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public ImageService(
            @Value("${supabase.url:}") String storageUrl,
            @Value("${SUPABASE_STORAGE_BUCKET:event-photos}") String bucket,
            @Value("${supabase.service-role-key:}") String serviceRoleKey
    ) {
        this.storageUrl = storageUrl.replaceAll("/+$", "");
        this.bucket = bucket == null || bucket.isBlank()
                ? "event-photos"
                : bucket.trim();
        this.serviceRoleKey = serviceRoleKey;
        this.restClient = RestClient.builder().build();
        this.objectMapper = new ObjectMapper();
    }

    public String saveImage(
            MultipartFile file,
            String category
    ) throws IOException {

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException(
                    "Please select an image."
            );
        }

        if (file.getSize() > 10 * 1024 * 1024) {
            throw new IllegalArgumentException(
                    "Image is too large. Maximum size is 10 MB."
            );
        }

        String contentType = file.getContentType();

        if (contentType == null ||
                !ALLOWED_CONTENT_TYPES.contains(
                        contentType.toLowerCase()
                )) {

            throw new IllegalArgumentException(
                    "Only JPG, PNG, and WEBP images are allowed."
            );
        }

        String originalFilename = file.getOriginalFilename();

        if (originalFilename == null ||
                originalFilename.isBlank()) {

            throw new IllegalArgumentException(
                    "Invalid filename."
            );
        }

        String extension = getExtension(originalFilename);

        if (!ALLOWED_EXTENSIONS.contains(
                extension.toLowerCase()
        )) {

            throw new IllegalArgumentException(
                    "Invalid image extension."
            );
        }

        if (!isRealImage(file)) {
            throw new IllegalArgumentException(
                    "The uploaded file is not a valid image."
            );
        }

        String safeCategory = sanitizeCategory(category);
        String newFilename = UUID.randomUUID()
                + extension.toLowerCase();

        ensureConfigured();

        try {
            restClient.post()
                    .uri(objectUri(safeCategory, newFilename))
                    .header("apikey", serviceRoleKey)
                    .header(
                            HttpHeaders.AUTHORIZATION,
                            "Bearer " + serviceRoleKey
                    )
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(file.getBytes())
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException e) {
            throw storageException(e);
        }

        return newFilename;
    }

    public List<ImageInfo> getImages(
            String category
    ) throws IOException {

        String safeCategory = sanitizeCategory(category);
        ensureConfigured();

        List<ImageInfo> images = new ArrayList<>();
        int offset = 0;

        while (true) {
            List<String> filenames = listImagePage(
                    safeCategory,
                    offset
            );

            filenames.forEach(filename ->
                    images.add(new ImageInfo(
                            filename,
                            getImageUrl(safeCategory, filename)
                    ))
            );

            if (filenames.size() < PAGE_SIZE) {
                return images;
            }

            offset += PAGE_SIZE;
        }
    }

    public void deleteImage(
            String category,
            String filename
    ) throws IOException {

        String safeCategory = sanitizeCategory(category);
        String safeFilename = Paths.get(filename)
                .getFileName()
                .toString();

        if (!safeFilename.equals(filename)) {
            throw new IllegalArgumentException(
                    "Invalid file path."
            );
        }

        ensureConfigured();

        byte[] requestBody = objectMapper.writeValueAsBytes(
                Map.of("prefixes", List.of(
                        safeCategory + "/" + safeFilename
                ))
        );

        try {
            restClient.method(org.springframework.http.HttpMethod.DELETE)
                    .uri(bucketUri())
                    .header("apikey", serviceRoleKey)
                    .header(
                            HttpHeaders.AUTHORIZATION,
                            "Bearer " + serviceRoleKey
                    )
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException e) {
            throw storageException(e);
        }
    }

    public String getImageUrl(
            String category,
            String filename
    ) {
        ensureConfigured();

        return UriComponentsBuilder.fromUriString(storageUrl)
                .pathSegment(
                        "storage",
                        "v1",
                        "object",
                        "public",
                        bucket,
                        sanitizeCategory(category),
                        filename
                )
                .build()
                .encode()
                .toUriString();
    }

    private List<String> listImagePage(
            String category,
            int offset
    ) throws IOException {

        byte[] requestBody = objectMapper.writeValueAsBytes(
                Map.of(
                        "prefix", category + "/",
                        "limit", PAGE_SIZE,
                        "offset", offset,
                        "sortBy", Map.of(
                                "column", "name",
                                "order", "asc"
                        )
                )
        );

        try {
            byte[] responseBody = restClient.post()
                    .uri(listUri())
                    .header("apikey", serviceRoleKey)
                    .header(
                            HttpHeaders.AUTHORIZATION,
                            "Bearer " + serviceRoleKey
                    )
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(byte[].class);

            JsonNode response = objectMapper.readTree(responseBody);

            if (response == null || !response.isArray()) {
                throw new IOException(
                        "Supabase Storage returned an invalid image list."
                );
            }

            List<String> filenames = new ArrayList<>();

            for (JsonNode item : response) {
                JsonNode name = item.get("name");
                JsonNode id = item.get("id");

                if (name != null &&
                        name.isTextual() &&
                        id != null &&
                        !id.isNull()) {
                    filenames.add(name.asText());
                }
            }

            return filenames;
        } catch (RestClientException e) {
            throw storageException(e);
        }
    }

    private URI objectUri(
            String category,
            String filename
    ) {
        return UriComponentsBuilder.fromUriString(storageUrl)
                .pathSegment(
                        "storage",
                        "v1",
                        "object",
                        bucket,
                        category,
                        filename
                )
                .build()
                .encode()
                .toUri();
    }

    private URI listUri() {
        return UriComponentsBuilder.fromUriString(storageUrl)
                .pathSegment(
                        "storage",
                        "v1",
                        "object",
                        "list",
                        bucket
                )
                .build()
                .encode()
                .toUri();
    }

    private URI bucketUri() {
        return UriComponentsBuilder.fromUriString(storageUrl)
                .pathSegment(
                        "storage",
                        "v1",
                        "object",
                        bucket
                )
                .build()
                .encode()
                .toUri();
    }

    private void ensureConfigured() {
        List<String> missingVariables = new ArrayList<>();

        if (storageUrl.isBlank()) {
            missingVariables.add("SUPABASE_URL");
        }

        if (serviceRoleKey == null || serviceRoleKey.isBlank()) {
            missingVariables.add("SUPABASE_SERVICE_ROLE_KEY");
        }

        if (!missingVariables.isEmpty()) {
            throw new IllegalStateException(
                    "Supabase Storage is not configured. Missing backend "
                            + "environment variable(s): "
                            + String.join(", ", missingVariables)
            );
        }
    }

    private IOException storageException(RestClientException exception) {
        if (exception instanceof RestClientResponseException response) {
            return new IOException(
                    "Supabase Storage returned HTTP "
                            + response.getStatusCode().value()
                            + ". Check the backend storage configuration "
                            + "and bucket permissions.",
                    exception
            );
        }

        return new IOException(
                "Could not connect to Supabase Storage.",
                exception
        );
    }

    private boolean isRealImage(
            MultipartFile file
    ) throws IOException {

        try (InputStream inputStream =
                     file.getInputStream()) {

            BufferedImage image =
                    ImageIO.read(inputStream);

            return image != null;
        }
    }

    private String getExtension(
            String filename
    ) {

        int lastDot = filename.lastIndexOf('.');

        if (lastDot == -1) {
            return "";
        }

        return filename
                .substring(lastDot)
                .toLowerCase();
    }

    private String sanitizeCategory(
            String category
    ) {

        if (category == null || category.isBlank()) {
            return "other";
        }

        String cleaned = category
                .toLowerCase()
                .trim()
                .replaceAll(
                        "[^a-z0-9-]",
                        ""
                );

        return switch (cleaned) {
            case "wedding" -> "wedding";
            case "birthday" -> "birthday";
            case "christening" -> "christening";
            case "other" -> "other";
            default -> throw new IllegalArgumentException(
                    "Invalid category."
            );
        };
    }

    public record ImageInfo(
            String filename,
            String url
    ) {
    }
}
