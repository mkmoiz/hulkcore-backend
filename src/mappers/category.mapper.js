import { toIsoString } from "../utils/dates.js";

export function mapCategory(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    imageUrl: row.imageUrl ?? "",
    imageKey: row.imageKey ?? "",
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}
