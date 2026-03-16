import { getPool } from "../db/connection.js";
import { mapCarouselImage } from "../mappers/product.mapper.js";

export async function getCarouselImages() {
  const [rows] = await getPool().query(`
    SELECT
      id,
      title,
      image_url AS imageUrl,
      image_key AS imageKey,
      linked_product_id AS linkedProductId,
      sort_order AS sortOrder,
      is_active AS isActive,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM carousel_images
    ORDER BY sort_order ASC, created_at DESC
  `);

  return rows.map(mapCarouselImage);
}

export async function findCarouselImageById(id) {
  const [rows] = await getPool().query(
    `
      SELECT
        id,
        title,
        image_url AS imageUrl,
        image_key AS imageKey,
        linked_product_id AS linkedProductId,
        sort_order AS sortOrder,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM carousel_images
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return mapCarouselImage(rows[0]);
}

export async function createCarouselImage(input) {
  const now = new Date();
  await getPool().query(
    `
      INSERT INTO carousel_images (
        id,
        title,
        image_url,
        image_key,
        linked_product_id,
        sort_order,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.id,
      input.title ?? "",
      input.imageUrl ?? "",
      input.imageKey ?? "",
      input.linkedProductId ?? null,
      input.sortOrder ?? 0,
      input.isActive ? 1 : 0,
      now,
      now,
    ],
  );

  return findCarouselImageById(input.id);
}

export async function updateCarouselImageById(id, input) {
  const now = new Date();
  const [result] = await getPool().query(
    `
      UPDATE carousel_images
      SET
        title = ?,
        image_url = ?,
        image_key = ?,
        linked_product_id = ?,
        sort_order = ?,
        is_active = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [
      input.title ?? "",
      input.imageUrl ?? "",
      input.imageKey ?? "",
      input.linkedProductId ?? null,
      input.sortOrder ?? 0,
      input.isActive ? 1 : 0,
      now,
      id,
    ],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findCarouselImageById(id);
}

export async function deleteCarouselImageById(id) {
  const [result] = await getPool().query(
    `
      DELETE FROM carousel_images
      WHERE id = ?
    `,
    [id],
  );

  return result.affectedRows > 0;
}
