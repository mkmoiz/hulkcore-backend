import { getPool } from "../db/connection.js";
import { mapCategory } from "../mappers/category.mapper.js";

export async function getCategories() {
  const [rows] = await getPool().query(`
    SELECT
      id,
      name,
      slug,
      description,
      image_url AS imageUrl,
      image_key AS imageKey,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM categories
    ORDER BY created_at DESC
  `);

  return rows.map(mapCategory);
}

export async function findCategoryById(id) {
  const [rows] = await getPool().query(
    `
      SELECT
        id,
        name,
        slug,
        description,
        image_url AS imageUrl,
        image_key AS imageKey,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM categories
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return mapCategory(rows[0]);
}

export async function findCategoryByName(name, excludeId) {
  const params = [name];
  let sql = `
    SELECT
      id,
      name,
      slug,
      description,
      image_url AS imageUrl,
      image_key AS imageKey,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM categories
    WHERE LOWER(name) = LOWER(?)
  `;

  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }

  sql += " LIMIT 1";

  const [rows] = await getPool().query(sql, params);
  return mapCategory(rows[0]);
}

export async function createCategory(input) {
  const now = new Date();
  await getPool().query(
    `
      INSERT INTO categories (id, name, slug, description, image_url, image_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [input.id, input.name, input.slug, input.description, input.imageUrl ?? "", input.imageKey ?? "", now, now],
  );

  return findCategoryById(input.id);
}

export async function updateCategoryById(id, input) {
  const now = new Date();
  const [result] = await getPool().query(
    `
      UPDATE categories
      SET name = ?, slug = ?, description = ?, image_url = ?, image_key = ?, updated_at = ?
      WHERE id = ?
    `,
    [input.name, input.slug, input.description, input.imageUrl ?? "", input.imageKey ?? "", now, id],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findCategoryById(id);
}

export async function countProductsByCategoryId(categoryId) {
  const [rows] = await getPool().query(
    `
      SELECT COUNT(*) AS total
      FROM products
      WHERE category_id = ?
    `,
    [categoryId],
  );

  return Number(rows[0]?.total || 0);
}

export async function deleteCategoryById(id) {
  const [result] = await getPool().query(
    `
      DELETE FROM categories
      WHERE id = ?
    `,
    [id],
  );

  return result.affectedRows > 0;
}

export async function categoryExists(id) {
  const [rows] = await getPool().query(
    `
      SELECT id
      FROM categories
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows.length > 0;
}
