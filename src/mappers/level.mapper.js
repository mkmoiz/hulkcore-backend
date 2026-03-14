import { toIsoString } from "../utils/dates.js";
import { parseJsonStringArray } from "../utils/json.js";

export function mapLevel(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug ?? "",
    name: row.name ?? "",
    description: row.description ?? "",
    imageUrl: row.imageUrl ?? "",
    imageKey: row.imageKey ?? "",
    position: Number(row.position ?? 0),
    isActive: Boolean(row.isActive),
    ruleMode: row.ruleMode === "DYNAMIC" ? "DYNAMIC" : "CURATED",
    sortMode: row.sortMode ?? "featured",
    includeCategoryIds: parseJsonStringArray(row.includeCategoryIdsJson),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    levelProducts: [],
  };
}

export function mapLevelProduct(row, product) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    levelId: row.levelId,
    productId: row.productId,
    position: Number(row.position ?? 0),
    isPinned: Boolean(row.isPinned),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    product: product ?? null,
  };
}

export function mapLabReport(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    title: row.title ?? "",
    description: row.description ?? "",
    reportUrl: row.reportUrl ?? "",
    reportKey: row.reportKey ?? "",
    productId: row.productId ?? "",
    isActive: Boolean(row.isActive),
    position: Number(row.position ?? 0),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    product: row.productIdRef
      ? {
          id: row.productIdRef,
          name: row.productName ?? "",
          imageUrl: row.productImageUrl ?? "",
          sku: row.productSku ?? "",
        }
      : null,
  };
}
