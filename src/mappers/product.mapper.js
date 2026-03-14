import { toIsoString } from "../utils/dates.js";

export function mapProductImage(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    productId: row.productId,
    imageUrl: row.imageUrl ?? "",
    imageKey: row.imageKey ?? "",
    sortOrder: Number(row.sortOrder ?? 0),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export function mapProduct(row, productImageRows = []) {
  if (!row) {
    return null;
  }

  const mappedImages = productImageRows.map(mapProductImage).filter(Boolean);
  const fallbackImageUrl = row.imageUrl ?? "";
  const fallbackImageKey = row.imageKey ?? "";
  const images =
    mappedImages.length > 0
      ? mappedImages
      : fallbackImageUrl
        ? [
            {
              id: "",
              productId: row.id,
              imageUrl: fallbackImageUrl,
              imageKey: fallbackImageKey,
              sortOrder: 0,
              createdAt: toIsoString(row.createdAt),
              updatedAt: toIsoString(row.updatedAt),
            },
          ]
        : [];

  const primaryImage = images[0] ?? null;

  const offerPriceRaw = Number(row.offerPrice ?? row.price ?? 0);
  const offerPrice = Number.isFinite(offerPriceRaw) ? offerPriceRaw : 0;
  const originalPriceRaw = Number(row.originalPrice ?? row.price ?? offerPrice);
  const originalPriceCandidate = Number.isFinite(originalPriceRaw) ? originalPriceRaw : offerPrice;
  const originalPrice = originalPriceCandidate >= offerPrice ? originalPriceCandidate : offerPrice;

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    imageUrl: primaryImage?.imageUrl ?? fallbackImageUrl,
    imageKey: primaryImage?.imageKey ?? fallbackImageKey,
    images,
    sku: row.sku ?? "",
    badge: row.badge ?? "",
    subtitle: row.subtitle ?? "",
    categoryId: row.categoryId,
    price: offerPrice,
    originalPrice,
    offerPrice,
    stock: Number(row.stock),
    isActive: Boolean(row.isActive),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    category: row.categoryIdRef
      ? {
          id: row.categoryIdRef,
          name: row.categoryName,
          slug: row.categorySlug,
        }
      : null,
  };
}

export function mapCarouselImage(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title ?? "",
    imageUrl: row.imageUrl ?? "",
    imageKey: row.imageKey ?? "",
    sortOrder: Number(row.sortOrder ?? 0),
    isActive: Boolean(row.isActive),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}
