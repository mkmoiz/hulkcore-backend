import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

app.get("/api/carousel-images", async (_req, res, next) => {
  try {
    const carouselImages = await getCarouselImages();
    return res.json(carouselImages);
  } catch (error) {
    next(error);
  }
});

app.post("/api/carousel-images", requireAdminAccess, async (req, res, next) => {
  try {
    const validation = await validateCarouselImagePayload(req.body);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const carouselImage = await createCarouselImage({
      id: createId("carimg"),
      ...validation.value,
    });

    return res.status(201).json(carouselImage);
  } catch (error) {
    next(error);
  }
});

app.put("/api/carousel-images/:id", requireAdminAccess, async (req, res, next) => {
  try {
    const carouselImage = await findCarouselImageById(req.params.id);

    if (!carouselImage) {
      return res.status(404).json({ message: "Carousel image not found." });
    }

    const previousSnapshot = toCarouselStoreInput(carouselImage);
    const previousImageKey = resolveImageKeyFromPayload(carouselImage.imageKey, carouselImage.imageUrl);

    const validation = await validateCarouselImagePayload(req.body, carouselImage);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const nextImageKey = resolveImageKeyFromPayload(validation.value.imageKey, validation.value.imageUrl);
    validation.value.imageKey = nextImageKey;

    if (previousImageKey && previousImageKey !== nextImageKey && !isR2Configured()) {
      return res.status(503).json({ message: "Cloudflare R2 is not configured on the server." });
    }

    const updatedCarouselImage = await updateCarouselImageById(req.params.id, validation.value);
    if (!updatedCarouselImage) {
      return res.status(404).json({ message: "Carousel image not found." });
    }

    if (previousImageKey && previousImageKey !== nextImageKey) {
      try {
        await deleteImageFromR2ByKey(previousImageKey);
      } catch (storageError) {
        console.error("Failed to delete previous carousel image from R2:", storageError);

        try {
          await updateCarouselImageById(req.params.id, previousSnapshot);
        } catch (rollbackError) {
          console.error("Failed to rollback carousel image after R2 cleanup failure:", rollbackError);
          return res.status(502).json({
            message:
              "Carousel image cleanup failed and rollback also failed. Please inspect the record and R2 bucket manually.",
          });
        }

        if (nextImageKey && nextImageKey !== previousImageKey) {
          try {
            await deleteImageFromR2ByKey(nextImageKey);
          } catch (newImageCleanupError) {
            console.error("Failed to delete replacement carousel image during rollback:", newImageCleanupError);
          }
        }

        return res.status(502).json({
          message: "Carousel image update reverted because old image cleanup failed.",
        });
      }
    }

    return res.json(updatedCarouselImage);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/carousel-images/:id", requireAdminAccess, async (req, res, next) => {
  try {
    const carouselImage = await findCarouselImageById(req.params.id);

    if (!carouselImage) {
      return res.status(404).json({ message: "Carousel image not found." });
    }

    const snapshot = toCarouselStoreInput(carouselImage);
    const imageKey = resolveImageKeyFromPayload(carouselImage.imageKey, carouselImage.imageUrl);

    if (imageKey && !isR2Configured()) {
      return res.status(503).json({ message: "Cloudflare R2 is not configured on the server." });
    }

    const deleted = await deleteCarouselImageById(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Carousel image not found." });
    }

    if (imageKey) {
      try {
        await deleteImageFromR2ByKey(imageKey);
      } catch (storageError) {
        console.error("Failed to delete carousel image from R2:", storageError);

        try {
          await createCarouselImage({
            id: carouselImage.id,
            ...snapshot,
          });
        } catch (rollbackError) {
          console.error("Failed to rollback carousel image deletion after R2 cleanup failure:", rollbackError);
          return res.status(502).json({
            message:
              "Carousel image deletion failed after database remove. Rollback also failed; inspect database and R2 bucket manually.",
          });
        }

        return res.status(502).json({
          message: "Carousel image deletion was reverted because image cleanup failed.",
        });
      }
    }

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});


export default app;
