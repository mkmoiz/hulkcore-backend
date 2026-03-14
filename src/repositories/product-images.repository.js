import { createId } from "../utils.js";
import { getPool } from "../db/connection.js";
import { mapProductImage } from "../mappers/product.mapper.js";

export async function findProductImageRowsByProductIds(productIds, connection = getPool()) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return [];
  }

  const [rows] = await connection.query(
    `
      SELECT
        id,
        product_id AS productId,
        image_url AS imageUrl,
        image_key AS imageKey,
        sort_order AS sortOrder,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM product_images
      WHERE product_id IN (?)
      ORDER BY product_id ASC, sort_order ASC, created_at ASC
    `,
    [productIds],
  );

  return rows;
}

export function groupProductImageRowsByProductId(rows) {
  return rows.reduce((acc, row) => {
    const mapped = mapProductImage(row);
    if (!mapped) {
      return acc;
    }

    if (!acc[mapped.productId]) {
      acc[mapped.productId] = [];
    }

    acc[mapped.productId].push(mapped);
    return acc;
  }, {});
}

export async function replaceProductImagesByProductId(productId, images, connection = getPool()) {
  await connection.query(
    `
      DELETE FROM product_images
      WHERE product_id = ?
    `,
    [productId],
  );

  if (!Array.isArray(images) || images.length === 0) {
    return;
  }

  const now = new Date();
  for (const image of images) {
    await connection.query(
      `
        INSERT INTO product_images (
          id,
          product_id,
          image_url,
          image_key,
          sort_order,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [createId("pimg"), productId, image.imageUrl, image.imageKey ?? "", image.sortOrder ?? 0, now, now],
    );
  }
}
