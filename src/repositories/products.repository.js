import { createId } from "../utils.js";
import { getPool } from "../db/connection.js";
import { mapProduct } from "../mappers/product.mapper.js";
import { normalizeText, normalizeProductImageList } from "../utils/normalize.js";
import {
  findProductImageRowsByProductIds,
  groupProductImageRowsByProductId,
  replaceProductImagesByProductId,
} from "./product-images.repository.js";

function productSelectSql(whereClause = "") {
  return `
    SELECT
      p.id,
      p.name,
      p.description,
      p.image_url AS imageUrl,
      p.image_key AS imageKey,
      p.sku,
      p.badge,
      p.subtitle,
      p.category_id AS categoryId,
      p.price,
      p.original_price AS originalPrice,
      p.offer_price AS offerPrice,
      p.rating_avg AS ratingAvg,
      p.review_count AS reviewCount,
      p.stock,
      p.is_active AS isActive,
      p.created_at AS createdAt,
      p.updated_at AS updatedAt,
      c.id AS categoryIdRef,
      c.name AS categoryName,
      c.slug AS categorySlug
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${whereClause}
  `;
}

export async function getProducts(categoryId) {
  const sql = categoryId
    ? `${productSelectSql("WHERE p.category_id = ?")} ORDER BY p.created_at DESC`
    : `${productSelectSql()} ORDER BY p.created_at DESC`;
  const params = categoryId ? [categoryId] : [];
  const [rows] = await getPool().query(sql, params);
  const productIds = rows.map((row) => row.id);
  const imageRows = await findProductImageRowsByProductIds(productIds);
  const imagesByProductId = groupProductImageRowsByProductId(imageRows);
  return rows.map((row) => mapProduct(row, imagesByProductId[row.id] ?? []));
}

export async function findProductById(id) {
  const [rows] = await getPool().query(
    `${productSelectSql("WHERE p.id = ?")} LIMIT 1`,
    [id],
  );

  const productRow = rows[0];
  if (!productRow) {
    return null;
  }

  const imageRows = await findProductImageRowsByProductIds([id]);
  return mapProduct(productRow, imageRows);
}

export async function createProduct(input) {
  const normalizedImages = normalizeProductImageList(input?.images, input?.imageUrl, input?.imageKey);
  const primaryImage = normalizedImages[0] ?? {
    imageUrl: normalizeText(input?.imageUrl),
    imageKey: normalizeText(input?.imageKey),
  };
  const offerPriceRaw = Number(input?.offerPrice ?? input?.price ?? 0);
  const offerPrice = Number.isFinite(offerPriceRaw) ? offerPriceRaw : 0;
  const originalPriceRaw = Number(input?.originalPrice ?? offerPrice);
  const originalPrice = Number.isFinite(originalPriceRaw) && originalPriceRaw >= offerPrice ? originalPriceRaw : offerPrice;
  const now = new Date();
  await getPool().query(
    `
      INSERT INTO products (
        id,
        name,
        description,
        image_url,
        image_key,
        sku,
        badge,
        subtitle,
        category_id,
        price,
        original_price,
        offer_price,
        stock,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.id,
      input.name,
      input.description,
      primaryImage.imageUrl ?? "",
      primaryImage.imageKey ?? "",
      input.sku,
      input.badge ?? "",
      input.subtitle ?? "",
      input.categoryId,
      offerPrice,
      originalPrice,
      offerPrice,
      input.stock,
      input.isActive ? 1 : 0,
      now,
      now,
    ],
  );

  await replaceProductImagesByProductId(input.id, normalizedImages);
  return findProductById(input.id);
}

export async function updateProductById(id, input) {
  const normalizedImages = normalizeProductImageList(input?.images, input?.imageUrl, input?.imageKey);
  const primaryImage = normalizedImages[0] ?? {
    imageUrl: normalizeText(input?.imageUrl),
    imageKey: normalizeText(input?.imageKey),
  };
  const offerPriceRaw = Number(input?.offerPrice ?? input?.price ?? 0);
  const offerPrice = Number.isFinite(offerPriceRaw) ? offerPriceRaw : 0;
  const originalPriceRaw = Number(input?.originalPrice ?? offerPrice);
  const originalPrice = Number.isFinite(originalPriceRaw) && originalPriceRaw >= offerPrice ? originalPriceRaw : offerPrice;
  const now = new Date();
  const [result] = await getPool().query(
    `
      UPDATE products
      SET
        name = ?,
        description = ?,
        image_url = ?,
        image_key = ?,
        sku = ?,
        badge = ?,
        subtitle = ?,
        category_id = ?,
        price = ?,
        original_price = ?,
        offer_price = ?,
        stock = ?,
        is_active = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [
      input.name,
      input.description,
      primaryImage.imageUrl ?? "",
      primaryImage.imageKey ?? "",
      input.sku,
      input.badge ?? "",
      input.subtitle ?? "",
      input.categoryId,
      offerPrice,
      originalPrice,
      offerPrice,
      input.stock,
      input.isActive ? 1 : 0,
      now,
      id,
    ],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  await replaceProductImagesByProductId(id, normalizedImages);
  return findProductById(id);
}

export async function deleteProductById(id) {
  const normalizedId = normalizeText(id);
  if (!normalizedId) {
    return false;
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `
        DELETE FROM cart_items
        WHERE product_id = ?
      `,
      [normalizedId],
    );

    const [result] = await connection.query(
      `
        DELETE FROM products
        WHERE id = ?
      `,
      [normalizedId],
    );

    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateProductRatingStats(id, ratingAvg, reviewCount) {
  const [result] = await getPool().query(
    `
      UPDATE products
      SET rating_avg = ?, review_count = ?
      WHERE id = ?
    `,
    [ratingAvg, reviewCount, id],
  );
  return result.affectedRows > 0;
}
