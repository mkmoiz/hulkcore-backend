import { getPrisma } from "../db/prisma.js";
import { mapProduct } from "../mappers/product.mapper.js";
import { createId } from "../utils.js";
import { findProductImageRowsByProductIds, groupProductImageRowsByProductId } from "./product-images.repository.js";

export async function getWishlistByUserId(userId) {
  const items = await getPrisma().wishlistItem.findMany({
    where: { userId },
    include: {
      product: {
        include: { category: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (items.length === 0) {
    return [];
  }

  const productIds = items.map((item) => item.productId);
  const imageRows = await findProductImageRowsByProductIds(productIds);
  const imagesByProductId = groupProductImageRowsByProductId(imageRows);

  return items.map((item) => {
    const p = item.product;
    const mappedProduct = mapProduct(
      {
        ...p,
        categoryIdRef: p.category?.id ?? null,
        categoryName: p.category?.name ?? null,
        categorySlug: p.category?.slug ?? null,
      },
      imagesByProductId[p.id] ?? [],
    );

    return {
      id: item.id,
      userId: item.userId,
      productId: item.productId,
      createdAt: item.createdAt,
      product: mappedProduct,
    };
  });
}

export async function addWishlistItem(userId, productId) {
  try {
    const existing = await getPrisma().wishlistItem.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });

    if (existing) {
      return existing;
    }

    const newItem = await getPrisma().wishlistItem.create({
      data: {
        id: createId("wli"),
        userId,
        productId,
        createdAt: new Date(),
      },
    });
    return newItem;
  } catch (error) {
    if (error.code === "P2003") {
      // Foreign key constraint failed (product doesn't exist)
      throw new Error("Product not found");
    }
    throw error;
  }
}

export async function removeWishlistItem(userId, productId) {
  try {
    await getPrisma().wishlistItem.delete({
      where: {
        userId_productId: { userId, productId },
      },
    });
    return true;
  } catch (error) {
    if (error.code === "P2025") {
      // Record not found
      return false;
    }
    throw error;
  }
}
