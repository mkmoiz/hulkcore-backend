import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

app.get("/api/categories", async (_req, res, next) => {
  try {
    const categories = await getCategories();
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

app.post("/api/categories", requireAdminAccess, async (req, res, next) => {
  try {
    const validation = await validateCategoryPayload(req.body);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const duplicate = await findCategoryByName(validation.value.name);
    if (duplicate) {
      return res.status(409).json({ message: "Category with this name already exists." });
    }

    const category = await createCategory({
      id: createId("cat"),
      ...validation.value,
    });

    await invalidatePublicCatalogCaches();
    return res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

app.put("/api/categories/:id", requireAdminAccess, async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await findCategoryById(id);

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    const previousCategorySnapshot = toCategoryStoreInput(category);
    const previousImageKey = resolveImageKeyFromPayload(category.imageKey, category.imageUrl);

    const validation = await validateCategoryPayload(req.body, category);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const duplicate = await findCategoryByName(validation.value.name, id);
    if (duplicate) {
      return res.status(409).json({ message: "Category with this name already exists." });
    }

    const nextImageKey = resolveImageKeyFromPayload(validation.value.imageKey, validation.value.imageUrl);
    validation.value.imageKey = nextImageKey;

    if (previousImageKey && previousImageKey !== nextImageKey && !isR2Configured()) {
      return res.status(503).json({ message: "Cloudflare R2 is not configured on the server." });
    }

    const updatedCategory = await updateCategoryById(id, validation.value);

    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found." });
    }

    if (previousImageKey && previousImageKey !== nextImageKey) {
      try {
        await deleteImageFromR2ByKey(previousImageKey);
      } catch (storageError) {
        console.error("Failed to delete previous category image from R2:", storageError);

        try {
          await updateCategoryById(id, previousCategorySnapshot);
        } catch (rollbackError) {
          console.error("Failed to rollback category after R2 cleanup failure:", rollbackError);
          return res.status(502).json({
            message:
              "Category image cleanup failed and rollback also failed. Please inspect the category and R2 bucket manually.",
          });
        }

        if (nextImageKey && nextImageKey !== previousImageKey) {
          try {
            await deleteImageFromR2ByKey(nextImageKey);
          } catch (newImageCleanupError) {
            console.error("Failed to delete replacement category image during rollback:", newImageCleanupError);
          }
        }

        return res.status(502).json({
          message: "Category update reverted because old image cleanup failed.",
        });
      }
    }

    await invalidatePublicCatalogCaches();
    return res.json(updatedCategory);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/categories/:id", requireAdminAccess, async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await findCategoryById(id);

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    const linkedProducts = await countProductsByCategoryId(id);
    if (linkedProducts > 0) {
      return res.status(409).json({ message: "Category is linked to existing products." });
    }

    const categorySnapshot = toCategoryStoreInput(category);
    const imageKey = resolveImageKeyFromPayload(category.imageKey, category.imageUrl);

    if (imageKey && !isR2Configured()) {
      return res.status(503).json({ message: "Cloudflare R2 is not configured on the server." });
    }

    const deleted = await deleteCategoryById(id);
    if (!deleted) {
      return res.status(404).json({ message: "Category not found." });
    }

    if (imageKey) {
      try {
        await deleteImageFromR2ByKey(imageKey);
      } catch (storageError) {
        console.error("Failed to delete category image from R2:", storageError);

        try {
          await createCategory({
            id: category.id,
            ...categorySnapshot,
          });
        } catch (rollbackError) {
          console.error("Failed to rollback category deletion after R2 cleanup failure:", rollbackError);
          return res.status(502).json({
            message:
              "Category deletion failed after database remove. Category rollback also failed; inspect database and R2 bucket manually.",
          });
        }

        return res.status(502).json({
          message: "Category deletion was reverted because image cleanup failed.",
        });
      }
    }

    await invalidatePublicCatalogCaches();
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});


export default app;
