import { createId } from "../utils.js";
import { cleanText } from "../utils/helpers.js";
import {
  createProductReviewRow,
  getApprovedReviewsByProduct,
  getAllReviewsRow,
  updateReviewApproval,
  updateReviewHighlight,
  getHighlightedReviewsRow,
  deleteReviewRow,
  getReviewStatsForProduct,
} from "../repositories/review.repository.js";
import { updateProductRatingStats } from "../repositories/products.repository.js";

// Triggers the update on the aggregated rating logic
async function __syncProductRatingStats(productId) {
  const stats = await getReviewStatsForProduct(productId);
  await updateProductRatingStats(productId, stats.ratingAvg, stats.reviewCount);
}

export async function createProductReview(input) {
  const id = createId("rev");
  const review = await createProductReviewRow({
    id,
    productId: cleanText(input.productId),
    userId: cleanText(input.userId),
    rating: Math.max(1, Math.min(5, Number(input.rating) || 5)),
    headline: cleanText(input.headline),
    comment: cleanText(input.comment),
  });

  // Automatically updating rating stats isn't fully necessary initially because it's not approved yet,
  // but running it ensures data consistency just in case.
  await __syncProductRatingStats(input.productId);
  return review;
}

export async function fetchApprovedProductReviews(productId) {
  return getApprovedReviewsByProduct(cleanText(productId));
}

export async function fetchAllReviews(filters = {}) {
  return getAllReviewsRow({
    ...filters,
    productId: cleanText(filters.productId),
  });
}

export async function approveReview(id) {
  const reviewId = cleanText(id);
  const updatedReview = await updateReviewApproval(reviewId, true);
  if (updatedReview) {
    await __syncProductRatingStats(updatedReview.productId);
  }
  return updatedReview;
}

export async function rejectReview(id) {
  const reviewId = cleanText(id);
  const updatedReview = await updateReviewApproval(reviewId, false);
  if (updatedReview) {
    await __syncProductRatingStats(updatedReview.productId);
  }
  return updatedReview;
}

export async function highlightReview(id) {
  const reviewId = cleanText(id);
  return updateReviewHighlight(reviewId, true);
}

export async function unhighlightReview(id) {
  const reviewId = cleanText(id);
  return updateReviewHighlight(reviewId, false);
}

export async function fetchHighlightedReviews() {
  return getHighlightedReviewsRow();
}

export async function deleteReviewById(id, productId) {
  const reviewId = cleanText(id);
  const success = await deleteReviewRow(reviewId);
  if (success && productId) {
    await __syncProductRatingStats(productId);
  }
  return success;
}
