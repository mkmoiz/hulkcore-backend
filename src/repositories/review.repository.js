import { getPrisma } from "../db/prisma.js";
import { mapProductReview } from "../mappers/review.mapper.js";

export async function createProductReviewRow(input) {
  const now = new Date();
  await getPrisma().productReview.create({
    data: {
      id: input.id,
      productId: input.productId,
      userId: input.userId,
      rating: input.rating,
      headline: input.headline || null,
      comment: input.comment || null,
      isApproved: false,
      isHighlighted: false,
      createdAt: now,
      updatedAt: now,
    },
  });

  return findReviewById(input.id);
}

export async function findReviewById(id) {
  const row = await getPrisma().productReview.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!row) return null;

  return mapProductReview({
    ...row,
    userName: row.user?.fullName,
  });
}

export async function getApprovedReviewsByProduct(productId) {
  const rows = await getPrisma().productReview.findMany({
    where: { productId, isApproved: true },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) =>
    mapProductReview({
      ...row,
      userName: row.user?.fullName,
    })
  );
}

export async function getAllReviewsRow(filters = {}) {
  const where = {};
  if (filters.productId) {
    where.productId = filters.productId;
  }
  if (filters.isApproved !== undefined && filters.isApproved !== null) {
    where.isApproved = filters.isApproved ? true : false;
  }

  const queryParams = {
    where,
    include: { user: true },
    orderBy: { createdAt: "desc" },
  };

  if (filters.limit) {
    queryParams.take = filters.limit;
    if (filters.offset !== undefined) {
      queryParams.skip = filters.offset;
    }
  }

  const rows = await getPrisma().productReview.findMany(queryParams);

  return rows.map((row) =>
    mapProductReview({
      ...row,
      userName: row.user?.fullName,
    })
  );
}

export async function updateReviewApproval(id, isApproved) {
  const now = new Date();
  try {
    await getPrisma().productReview.update({
      where: { id },
      data: { isApproved: isApproved ? true : false, updatedAt: now },
    });
  } catch (error) {
    if (error.code === "P2025") {
      return null;
    }
    throw error;
  }

  return findReviewById(id);
}

export async function getHighlightedReviewsRow() {
  const rows = await getPrisma().productReview.findMany({
    where: { isHighlighted: true, isApproved: true },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return rows.map((row) =>
    mapProductReview({
      ...row,
      userName: row.user?.fullName,
    })
  );
}

export async function updateReviewHighlight(id, isHighlighted) {
  const now = new Date();
  try {
    await getPrisma().productReview.update({
      where: { id },
      data: { isHighlighted: isHighlighted ? true : false, updatedAt: now },
    });
  } catch (error) {
    if (error.code === "P2025") {
      return null;
    }
    throw error;
  }

  return findReviewById(id);
}

export async function deleteReviewRow(id) {
  try {
    await getPrisma().productReview.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    if (error.code === "P2025") {
      return false;
    }
    throw error;
  }
}

export async function getReviewStatsForProduct(productId) {
  const stats = await getPrisma().productReview.aggregate({
    where: { productId, isApproved: true },
    _count: { id: true },
    _avg: { rating: true },
  });

  return {
    reviewCount: stats._count.id ?? 0,
    ratingAvg: parseFloat((stats._avg.rating ?? 0).toFixed(2)),
  };
}
