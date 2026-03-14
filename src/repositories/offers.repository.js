import { createId } from "../utils.js";
import { getPool } from "../db/connection.js";
import { mapProduct } from "../mappers/product.mapper.js";
import { toIsoString } from "../utils/dates.js";
import { findProductImageRowsByProductIds, groupProductImageRowsByProductId } from "./product-images.repository.js";

export async function getOfferProducts(includeHidden = true) {
  const [rows] = await getPool().query(
    `
      SELECT
        op.id,
        op.product_id AS productId,
        op.badge AS offerBadge,
        op.subtitle AS offerSubtitle,
        op.position,
        op.is_active AS isActive,
        op.created_at AS createdAt,
        op.updated_at AS updatedAt,
        p.id AS productIdRef,
        p.name,
        p.description,
        p.image_url AS imageUrl,
        p.image_key AS imageKey,
        p.sku,
        p.badge AS productBadge,
        p.subtitle AS productSubtitle,
        p.category_id AS categoryId,
        p.price,
        p.original_price AS originalPrice,
        p.offer_price AS offerPrice,
        p.stock,
        p.is_active AS productIsActive,
        p.created_at AS productCreatedAt,
        p.updated_at AS productUpdatedAt,
        c.id AS categoryIdRef,
        c.name AS categoryName,
        c.slug AS categorySlug
      FROM offer_products op
      JOIN products p ON p.id = op.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      ${includeHidden ? "" : "WHERE op.is_active = 1"}
      ORDER BY op.position ASC, op.created_at ASC
    `,
  );

  const productIds = rows.map((row) => row.productIdRef).filter(Boolean);
  const imageRows = await findProductImageRowsByProductIds(productIds);
  const imagesByProductId = groupProductImageRowsByProductId(imageRows);

  return rows.map((row, index) => ({
    id: row.id,
    productId: row.productId,
    badge: row.offerBadge ?? "",
    subtitle: row.offerSubtitle ?? "",
    position: Number(row.position ?? index),
    isActive: Boolean(row.isActive),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    product: mapProduct(
      {
        id: row.productIdRef,
        name: row.name,
        description: row.description,
        imageUrl: row.imageUrl,
        imageKey: row.imageKey,
        sku: row.sku,
        badge: row.productBadge,
        subtitle: row.productSubtitle,
        categoryId: row.categoryId,
        price: row.price,
        originalPrice: row.originalPrice,
        offerPrice: row.offerPrice,
        stock: row.stock,
        isActive: row.productIsActive,
        createdAt: row.productCreatedAt,
        updatedAt: row.productUpdatedAt,
        categoryIdRef: row.categoryIdRef,
        categoryName: row.categoryName,
        categorySlug: row.categorySlug,
      },
      imagesByProductId[row.productIdRef] ?? [],
    ),
  }));
}

export async function replaceOfferProducts(entries) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    await connection.query("DELETE FROM offer_products");
    const now = new Date();
    for (const [index, entry] of entries.entries()) {
      await connection.query(
        `
          INSERT INTO offer_products (
            id,
            product_id,
            badge,
            subtitle,
            position,
            is_active,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          createId("ofp"),
          entry.productId,
          entry.badge ?? "",
          entry.subtitle ?? "",
          index,
          entry.isActive ? 1 : 0,
          now,
          now,
        ],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getOfferProducts(true);
}
