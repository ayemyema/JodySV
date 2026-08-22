package com.jodysv.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ImageService {

    private final Path uploadDirectory =
            Paths.get("uploads").toAbsolutePath().normalize();

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

    public ImageService() {
        try {
            Files.createDirectories(uploadDirectory);

            Files.createDirectories(uploadDirectory.resolve("wedding"));
            Files.createDirectories(uploadDirectory.resolve("birthday"));
            Files.createDirectories(uploadDirectory.resolve("christening"));
            Files.createDirectories(uploadDirectory.resolve("other"));

            System.out.println("Upload directory: " + uploadDirectory);

        } catch (IOException e) {
            throw new RuntimeException(
                    "Could not create upload directories.",
                    e
            );
        }
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

        Path categoryDirectory = uploadDirectory
                .resolve(safeCategory)
                .normalize();

        Files.createDirectories(categoryDirectory);

        String newFilename = UUID.randomUUID()
                + extension.toLowerCase();

        Path destination = categoryDirectory
                .resolve(newFilename)
                .normalize();

        if (!destination.startsWith(categoryDirectory)) {
            throw new IllegalArgumentException(
                    "Invalid file path."
            );
        }

        Files.copy(
                file.getInputStream(),
                destination,
                StandardCopyOption.REPLACE_EXISTING
        );

        System.out.println(
                "Image saved: " + destination
        );

        return newFilename;
    }

    public List<String> getImages(
            String category
    ) throws IOException {

        String safeCategory = sanitizeCategory(category);

        Path categoryDirectory = uploadDirectory
                .resolve(safeCategory)
                .normalize();

        if (!Files.exists(categoryDirectory)) {
            return List.of();
        }

        try (var files = Files.list(categoryDirectory)) {

            return files
                    .filter(Files::isRegularFile)
                    .map(path ->
                            path.getFileName().toString()
                    )
                    .sorted()
                    .toList();
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

        Path categoryDirectory = uploadDirectory
                .resolve(safeCategory)
                .normalize();

        Path imagePath = categoryDirectory
                .resolve(safeFilename)
                .normalize();

        if (!imagePath.startsWith(categoryDirectory)) {
            throw new IllegalArgumentException(
                    "Invalid file path."
            );
        }

        Files.deleteIfExists(imagePath);
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
}
