import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

app.get(["/api/admin/levels", "/admin/levels"], requireAdminAccess, async (_req, res, next) => {
  try {
    const levels = await getLevels(true);
    return res.json({ levels });
  } catch (error) {
    next(error);
  }
});

app.post(["/api/admin/levels", "/admin/levels"], requireAdminAccess, async (req, res, next) => {
  try {
    const validation = await validateLevelPayload(req.body);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const duplicate = await findLevelByName(validation.value.name);
    if (duplicate) {
      return res.status(409).json({ message: "Level with this name already exists." });
    }

    const created = await createLevel({
      id: createId("lvl"),
      ...validation.value,
    });
    await invalidatePublicLevelsCache();
    return res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.put(["/api/admin/levels/:id", "/admin/levels/:id"], requireAdminAccess, async (req, res, next) => {
  try {
    const levelId = cleanText(req.params.id);
    if (!levelId) {
      return res.status(400).json({ message: "Level id is required." });
    }

    const level = await findLevelById(levelId);
    if (!level) {
      return res.status(404).json({ message: "Level not found." });
    }

    const previousImageKey = resolveImageKeyFromPayload(level.imageKey, level.imageUrl);
    const previousSnapshot = {
      slug: level.slug,
      name: level.name,
      description: level.description,
      imageUrl: level.imageUrl,
      imageKey: level.imageKey,
      position: level.position,
      isActive: level.isActive,
      ruleMode: level.ruleMode,
      sortMode: level.sortMode,
      includeCategoryIds: level.includeCategoryIds,
    };
    const previousAssignments = Array.isArray(level.levelProducts)
      ? level.levelProducts.map((entry, index) => ({
          productId: entry.productId,
          position: Number.isInteger(entry.position) ? entry.position : index,
          isPinned: Boolean(entry.isPinned),
        }))
      : [];

    const validation = await validateLevelPayload(req.body, level);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const duplicate = await findLevelByName(validation.value.name, levelId);
    if (duplicate) {
      return res.status(409).json({ message: "Level with this name already exists." });
    }

    const nextImageKey = resolveImageKeyFromPayload(validation.value.imageKey, validation.value.imageUrl);
    validation.value.imageKey = nextImageKey;

    if (previousImageKey && previousImageKey !== nextImageKey && !isR2Configured()) {
      return res.status(503).json({ message: "Cloudflare R2 is not configured on the server." });
    }

    const updatedLevel = await updateLevelById(levelId, validation.value);
    if (!updatedLevel) {
      return res.status(404).json({ message: "Level not found." });
    }

    if (previousImageKey && previousImageKey !== nextImageKey) {
      try {
        await deleteImageFromR2ByKey(previousImageKey);
      } catch (storageError) {
        console.error("Failed to delete previous level image from R2:", storageError);
        try {
          await updateLevelById(levelId, previousSnapshot);
          await replaceLevelProductAssignments(levelId, previousAssignments);
        } catch (rollbackError) {
          console.error("Failed to rollback level after R2 cleanup failure:", rollbackError);
          return res.status(502).json({
            message:
              "Level image cleanup failed and rollback also failed. Please inspect the level and R2 bucket manually.",
          });
        }

        if (nextImageKey && nextImageKey !== previousImageKey) {
          try {
            await deleteImageFromR2ByKey(nextImageKey);
          } catch (newImageCleanupError) {
            console.error("Failed to delete replacement level image during rollback:", newImageCleanupError);
          }
        }

        return res.status(502).json({
          message: "Level update reverted because old image cleanup failed.",
        });
      }
    }

    await invalidatePublicLevelsCache();
    return res.json(updatedLevel);
  } catch (error) {
    next(error);
  }
});

app.put(["/api/admin/levels/:id/products", "/admin/levels/:id/products"], requireAdminAccess, async (req, res, next) => {
  try {
    const levelId = cleanText(req.params.id);
    if (!levelId) {
      return res.status(400).json({ message: "Level id is required." });
    }

    const level = await findLevelById(levelId);
    if (!level) {
      return res.status(404).json({ message: "Level not found." });
    }

    const validation = await validateLevelProductsPayload(req.body);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const updated = await replaceLevelProductAssignments(levelId, validation.value);
    await invalidatePublicLevelsCache();
    return res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete(["/api/admin/levels/:id", "/admin/levels/:id"], requireAdminAccess, async (req, res, next) => {
  try {
    const levelId = cleanText(req.params.id);
    if (!levelId) {
      return res.status(400).json({ message: "Level id is required." });
    }

    const level = await findLevelById(levelId);
    if (!level) {
      return res.status(404).json({ message: "Level not found." });
    }

    const imageKey = resolveImageKeyFromPayload(level.imageKey, level.imageUrl);
    if (imageKey && !isR2Configured()) {
      return res.status(503).json({ message: "Cloudflare R2 is not configured on the server." });
    }

    const levelSnapshot = {
      slug: level.slug,
      name: level.name,
      description: level.description,
      imageUrl: level.imageUrl,
      imageKey: level.imageKey,
      position: level.position,
      isActive: level.isActive,
      ruleMode: level.ruleMode,
      sortMode: level.sortMode,
      includeCategoryIds: level.includeCategoryIds,
    };
    const levelAssignments = Array.isArray(level.levelProducts)
      ? level.levelProducts.map((entry, index) => ({
          productId: entry.productId,
          position: Number.isInteger(entry.position) ? entry.position : index,
          isPinned: Boolean(entry.isPinned),
        }))
      : [];

    const deleted = await deleteLevelById(levelId);
    if (!deleted) {
      return res.status(404).json({ message: "Level not found." });
    }

    if (imageKey) {
      try {
        await deleteImageFromR2ByKey(imageKey);
      } catch (storageError) {
        console.error("Failed to delete level image from R2:", storageError);
        try {
          await createLevel({
            id: levelId,
            ...levelSnapshot,
          });
          await replaceLevelProductAssignments(levelId, levelAssignments);
        } catch (rollbackError) {
          console.error("Failed to rollback level deletion after R2 cleanup failure:", rollbackError);
          return res.status(502).json({
            message:
              "Level deletion failed after database remove. Rollback also failed; inspect database and R2 bucket manually.",
          });
        }

        return res.status(502).json({
          message: "Level deletion was reverted because image cleanup failed.",
        });
      }
    }

    await invalidatePublicLevelsCache();
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});


export default app;
