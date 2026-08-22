package com.jodysv.backend.controller;

import com.jodysv.backend.service.ImageService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/images")
public class ImageController {

    private final ImageService imageService;

    public ImageController(ImageService imageService) {
        this.imageService = imageService;
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadImage(
            @RequestParam("image") MultipartFile image,
            @RequestParam(defaultValue = "other") String category) {

        try {

            String filename =
                    imageService.saveImage(image, category);

            String url =
                    "/uploads/" + category + "/" + filename;

            return ResponseEntity.ok(
                    Map.of(
                            "success", true,
                            "message", "Image uploaded successfully.",
                            "filename", filename,
                            "category", category,
                            "url", url
                    )
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .badRequest()
                    .body(Map.of(
                            "success", false,
                            "message", e.getMessage()
                    ));

        } catch (IOException e) {

            return ResponseEntity
                    .internalServerError()
                    .body(Map.of(
                            "success", false,
                            "message", "Could not save the image."
                    ));
        }
    }

    @GetMapping
    public ResponseEntity<?> getImages(
            @RequestParam(defaultValue = "other") String category) {

        try {

            List<String> images =
                    imageService.getImages(category);

            return ResponseEntity.ok(
                    Map.of(
                            "success", true,
                            "category", category,
                            "images", images
                    )
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .badRequest()
                    .body(Map.of(
                            "success", false,
                            "message", e.getMessage()
                    ));

        } catch (IOException e) {

            return ResponseEntity
                    .internalServerError()
                    .body(Map.of(
                            "success", false,
                            "message", "Could not load images."
                    ));
        }
    }

    @DeleteMapping
    public ResponseEntity<?> deleteImage(
            @RequestParam String category,
            @RequestParam String filename) {

        try {

            imageService.deleteImage(category, filename);

            return ResponseEntity.ok(
                    Map.of(
                            "success", true,
                            "message", "Image deleted successfully."
                    )
            );

        } catch (IllegalArgumentException e) {

            return ResponseEntity
                    .badRequest()
                    .body(Map.of(
                            "success", false,
                            "message", e.getMessage()
                    ));

        } catch (IOException e) {

            return ResponseEntity
                    .internalServerError()
                    .body(Map.of(
                            "success", false,
                            "message", "Could not delete the image."
                    ));
        }
    }
}
