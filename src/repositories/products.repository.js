import { createId } from "../utils.js";
import { getPrisma } from "../db/prisma.js";
import { mapProduct } from "../mappers/product.mapper.js";
import { normalizeText, normalizeProductImageList } from "../utils/normalize.js";
import {
  findProductImageRowsByProductIds,
  groupProductImageRowsByProductId,
  replaceProductImagesByProductId,
} from "./product-images.repository.js";

export async function getProducts(categoryId) {
  const where = categoryId ? { categoryId } : {};
  const rows = await getPrisma().product.findMany({
    where,
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  const productIds = rows.map((row) => row.id);
  const imageRows = await findProductImageRowsByProductIds(productIds);
  const imagesByProductId = groupProductImageRowsByProductId(imageRows);

  return rows.map((row) =>
    mapProduct(
      {
        ...row,
        categoryIdRef: row.category?.id ?? null,
        categoryName: row.category?.name ?? null,
        categorySlug: row.category?.slug ?? null,
      },
      imagesByProductId[row.id] ?? [],
    ),
  );
}

export async function searchProducts(query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return [];
  }

  const rows = await getPrisma().product.findMany({
    where: {
      OR: [
        { name: { contains: normalizedQuery } },
        { sku: { contains: normalizedQuery } },
        { subtitle: { contains: normalizedQuery } },
        { category: { name: { contains: normalizedQuery } } },
      ],
      isActive: true,
    },
    include: { category: true },
    take: 20,
  });

  const productIds = rows.map((row) => row.id);
  const imageRows = await findProductImageRowsByProductIds(productIds);
  const imagesByProductId = groupProductImageRowsByProductId(imageRows);

  return rows.map((row) =>
    mapProduct(
      {
        ...row,
        categoryIdRef: row.category?.id ?? null,
        categoryName: row.category?.name ?? null,
        categorySlug: row.category?.slug ?? null,
      },
      imagesByProductId[row.id] ?? [],
    ),
  );
}

export async function findProductById(id) {
  const row = await getPrisma().product.findUnique({
    where: { id },
    include: { category: true },
  });

  if (!row) {
    return null;
  }

  const imageRows = await findProductImageRowsByProductIds([id]);
  return mapProduct(
    {
      ...row,
      categoryIdRef: row.category?.id ?? null,
      categoryName: row.category?.name ?? null,
      categorySlug: row.category?.slug ?? null,
    },
    imageRows,
  );
}

export async function createProduct(input) {
  const normalizedImages = normalizeProductImageList(input?.images, input?.imageUrl, input?.imageKey);
  const primaryImage = normalizedImages[0] ?? {
    imageUrl: normalizeText(input?.imageUrl),
    imageKey: normalizeText(input?.imageKey),
  };
  const offerPriceRaw = Number(input?.offerPrice ?? input?.price ?? 0);
  const offerPrice = Number.isFinite(offerPriceRaw) ? offerPriceRaw : 0;
  const originalPriceRaw = Number(input?.originalPrice ?? offerPrice);
  const originalPrice = Number.isFinite(originalPriceRaw) && originalPriceRaw >= offerPrice ? originalPriceRaw : offerPrice;
  const now = new Date();

  await getPrisma().product.create({
    data: {
      id: input.id,
      name: input.name,
      description: input.description,
      imageUrl: primaryImage.imageUrl ?? "",
      imageKey: primaryImage.imageKey ?? "",
      sku: input.sku,
      badge: input.badge ?? "",
      subtitle: input.subtitle ?? "",
      categoryId: input.categoryId,
      price: offerPrice,
      originalPrice,
      offerPrice,
      stock: input.stock,
      isActive: input.isActive ? true : false,
      createdAt: now,
      updatedAt: now,
    },
  });

  await replaceProductImagesByProductId(input.id, normalizedImages);
  return findProductById(input.id);
}

export async function updateProductById(id, input) {
  const normalizedImages = normalizeProductImageList(input?.images, input?.imageUrl, input?.imageKey);
  const primaryImage = normalizedImages[0] ?? {
    imageUrl: normalizeText(input?.imageUrl),
    imageKey: normalizeText(input?.imageKey),
  };
  const offerPriceRaw = Number(input?.offerPrice ?? input?.price ?? 0);
  const offerPrice = Number.isFinite(offerPriceRaw) ? offerPriceRaw : 0;
  const originalPriceRaw = Number(input?.originalPrice ?? offerPrice);
  const originalPrice = Number.isFinite(originalPriceRaw) && originalPriceRaw >= offerPrice ? originalPriceRaw : offerPrice;
  const now = new Date();

  try {
    await getPrisma().product.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        imageUrl: primaryImage.imageUrl ?? "",
        imageKey: primaryImage.imageKey ?? "",
        sku: input.sku,
        badge: input.badge ?? "",
        subtitle: input.subtitle ?? "",
        categoryId: input.categoryId,
        price: offerPrice,
        originalPrice,
        offerPrice,
        stock: input.stock,
        isActive: input.isActive ? true : false,
        updatedAt: now,
      },
    });
  } catch (error) {
    if (error.code === "P2025") {
      return null;
    }
    throw error;
  }

  await replaceProductImagesByProductId(id, normalizedImages);
  return findProductById(id);
}

export async function deleteProductById(id) {
  const normalizedId = normalizeText(id);
  if (!normalizedId) {
    return false;
  }

  try {
    await getPrisma().$transaction(async (tx) => {
      await tx.cartItem.deleteMany({
        where: { productId: normalizedId },
      });

      await tx.product.delete({
        where: { id: normalizedId },
      });
    });

    return true;
  } catch (error) {
    if (error.code === "P2025") {
      return false;
    }
    throw error;
  }
}

export async function updateProductRatingStats(id, ratingAvg, reviewCount) {
  try {
    await getPrisma().product.update({
      where: { id },
      data: { ratingAvg, reviewCount },
    });
    return true;
  } catch (error) {
    if (error.code === "P2025") {
      return false;
    }
    throw error;
  }
}
