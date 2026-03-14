import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

app.get("/api/products", async (req, res, next) => {
  try {
    const { categoryId } = req.query;
    const normalizedCategoryId = typeof categoryId === "string" ? categoryId.trim() : "";
    const products = await getProducts(normalizedCategoryId || undefined);
    res.json(products);
  } catch (error) {
    next(error);
  }
});

app.get("/api/products/:id", async (req, res, next) => {
  try {
    const product = await findProductById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    return res.json(product);
  } catch (error) {
    next(error);
  }
});

app.post("/api/products", async (req, res, next) => {
  try {
    const validation = await validateProductPayload(req.body);

    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const product = await createProduct({
      id: createId("prod"),
      ...validation.value,
    });

    await invalidatePublicProductDependentCaches();
    return res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

app.put("/api/products/:id", async (req, res, next) => {
  try {
    const product = await findProductById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    const previousProductSnapshot = toProductStoreInput(product);
    const previousImageKeys = collectImageKeysFromProduct(product);
    const previousImageKeySet = new Set(previousImageKeys);

    const validation = await validateProductPayload(req.body, product);
    if (validation.error) {
      return res.status(400).json({ message: validation.error });
    }

    const nextImageKeySet = new Set(
      (validation.value.images ?? [])
        .map((image) => resolveImageKeyFromPayload(image?.imageKey, image?.imageUrl))
        .filter(Boolean),
    );
    const fallbackPrimaryImageKey = resolveImageKeyFromPayload(validation.value.imageKey, validation.value.imageUrl);
    if (fallbackPrimaryImageKey) {
      nextImageKeySet.add(fallbackPrimaryImageKey);
    }

    const imageKeysToDelete = previousImageKeys.filter((imageKey) => !nextImageKeySet.has(imageKey));
    const newlyAddedImageKeys = Array.from(nextImageKeySet).filter((imageKey) => !previousImageKeySet.has(imageKey));

    if (imageKeysToDelete.length > 0 && !isR2Configured()) {
      return res.status(503).json({ message: "Cloudflare R2 is not configured on the server." });
    }

    const updatedProduct = await updateProductById(req.params.id, validation.value);

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found." });
    }

    if (imageKeysToDelete.length > 0) {
      try {
        for (const imageKey of imageKeysToDelete) {
          await deleteImageFromR2ByKey(imageKey);
        }
      } catch (storageError) {
        console.error("Failed to delete previous product image(s) from R2:", storageError);

        try {
          await updateProductById(req.params.id, previousProductSnapshot);
        } catch (rollbackError) {
          console.error("Failed to rollback product after R2 cleanup failure:", rollbackError);
          return res.status(502).json({
            message:
              "Product image cleanup failed and rollback also failed. Please inspect the product and R2 bucket manually.",
          });
        }

        for (const imageKey of newlyAddedImageKeys) {
          try {
            await deleteImageFromR2ByKey(imageKey);
          } catch (newImageCleanupError) {
            console.error("Failed to delete replacement image during rollback:", newImageCleanupError);
          }
        }

        return res.status(502).json({
          message: "Product update reverted because old image cleanup failed.",
        });
      }
    }

    await invalidatePublicProductDependentCaches();
    return res.json(updatedProduct);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/products/:id", async (req, res, next) => {
  try {
    const product = await findProductById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    const productSnapshot = toProductStoreInput(product);
    const imageKeys = collectImageKeysFromProduct(product);

    if (imageKeys.length > 0 && !isR2Configured()) {
      return res.status(503).json({ message: "Cloudflare R2 is not configured on the server." });
    }

    const deleted = await deleteProductById(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Product not found." });
    }

    if (imageKeys.length > 0) {
      try {
        for (const imageKey of imageKeys) {
          await deleteImageFromR2ByKey(imageKey);
        }
      } catch (storageError) {
        console.error("Failed to delete product image(s) from R2:", storageError);

        try {
          await createProduct({
            id: product.id,
            ...productSnapshot,
          });
        } catch (rollbackError) {
          console.error("Failed to rollback product deletion after R2 cleanup failure:", rollbackError);
          return res.status(502).json({
            message:
              "Product deletion failed after database remove. Product rollback also failed; inspect database and R2 bucket manually.",
          });
        }

        return res.status(502).json({
          message: "Product deletion was reverted because image cleanup failed.",
        });
      }
    }

    await invalidatePublicProductDependentCaches();
    return res.status(204).send();
  } catch (error) {
    if (
      error?.code === "ER_ROW_IS_REFERENCED_2" &&
      typeof error?.sqlMessage === "string" &&
      error.sqlMessage.includes("fk_order_items_product")
    ) {
      return res.status(409).json({
        message: "Product is linked to existing orders and cannot be deleted.",
      });
    }

    next(error);
  }
});


export default app;
