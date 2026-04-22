export function mapProductReview(row) {
  if (!row) return null;

  return {
    id: row.id,
    productId: row.productId,
    userId: row.userId,
    userName: row.userName || "Anonymous", // Fetched via join
    rating: row.rating,
    headline: row.headline || "",
    comment: row.comment || "",
    isApproved: Boolean(row.isApproved),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}
