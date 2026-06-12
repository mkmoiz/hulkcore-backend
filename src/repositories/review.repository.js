import { getPool } from "../db/connection.js";
import { mapProductReview } from "../mappers/review.mapper.js";

function buildSelectBody() {
  return `
    SELECT
      r.id,
      r.product_id AS productId,
      r.user_id AS userId,
      u.full_name AS userName,
      r.rating,
      r.headline,
      r.comment,
      r.is_approved AS isApproved,
      r.is_highlighted AS isHighlighted,
      r.created_at AS createdAt,
      r.updated_at AS updatedAt
    FROM product_reviews r
    LEFT JOIN users u ON r.user_id = u.id
  `;
}

export async function createProductReviewRow(input) {
  const now = new Date();
  await getPool().query(
    `
      INSERT INTO product_reviews (
        id, product_id, user_id, rating, headline, comment, is_approved, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.id,
      input.productId,
      input.userId,
      input.rating,
      input.headline || "",
      input.comment || "",
      0, // is_approved defaults to false
      now,
      now,
    ],
  );

  return findReviewById(input.id);
}

export async function findReviewById(id) {
  const [rows] = await getPool().query(
    `
      ${buildSelectBody()}
      WHERE r.id = ?
    `,
    [id],
  );

  return mapProductReview(rows[0]);
}

export async function getApprovedReviewsByProduct(productId) {
  const [rows] = await getPool().query(
    `
      ${buildSelectBody()}
      WHERE r.product_id = ? AND r.is_approved = 1
      ORDER BY r.created_at DESC
    `,
    [productId],
  );

  return rows.map(mapProductReview);
}

export async function getAllReviewsRow(filters = {}) {
  let query = buildSelectBody() + " WHERE 1=1";
  const params = [];

  if (filters.productId) {
    query += " AND r.product_id = ?";
    params.push(filters.productId);
  }

  if (filters.isApproved !== undefined && filters.isApproved !== null) {
    query += " AND r.is_approved = ?";
    params.push(filters.isApproved ? 1 : 0);
  }

  query += " ORDER BY r.created_at DESC";

  if (filters.limit) {
    query += " LIMIT ?";
    params.push(filters.limit);
    if (filters.offset !== undefined) {
      query += " OFFSET ?";
      params.push(filters.offset);
    }
  }

  const [rows] = await getPool().query(query, params);
  return rows.map(mapProductReview);
}

export async function updateReviewApproval(id, isApproved) {
  const now = new Date();
  await getPool().query(
    `
      UPDATE product_reviews
      SET is_approved = ?, updated_at = ?
      WHERE id = ?
    `,
    [isApproved ? 1 : 0, now, id],
  );

  return findReviewById(id);
}

export async function getHighlightedReviewsRow() {
  const [rows] = await getPool().query(
    `
      ${buildSelectBody()}
      WHERE r.is_highlighted = 1 AND r.is_approved = 1
      ORDER BY r.created_at DESC
      LIMIT 10
    `
  );

  return rows.map(mapProductReview);
}

export async function updateReviewHighlight(id, isHighlighted) {
  const now = new Date();
  await getPool().query(
    `
      UPDATE product_reviews
      SET is_highlighted = ?, updated_at = ?
      WHERE id = ?
    `,
    [isHighlighted ? 1 : 0, now, id],
  );

  return findReviewById(id);
}

export async function deleteReviewRow(id) {
  const [result] = await getPool().query(
    `
      DELETE FROM product_reviews
      WHERE id = ?
    `,
    [id],
  );
  return result.affectedRows > 0;
}

export async function getReviewStatsForProduct(productId) {
  const [rows] = await getPool().query(
    `
      SELECT
        COUNT(*) AS reviewCount,
        COALESCE(AVG(rating), 0) AS ratingAvg
      FROM product_reviews
      WHERE product_id = ? AND is_approved = 1
    `,
    [productId],
  );

  if (!rows || rows.length === 0) {
    return { reviewCount: 0, ratingAvg: 0 };
  }

  return {
    reviewCount: Number(rows[0].reviewCount),
    ratingAvg: parseFloat(Number(rows[0].ratingAvg).toFixed(2)),
  };
}
