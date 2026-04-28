import { createId } from "../utils.js";
import { getPool } from "../db/connection.js";
import { mapProduct } from "../mappers/product.mapper.js";
import { toIsoString } from "../utils/dates.js";
import { findProductImageRowsByProductIds, groupProductImageRowsByProductId } from "./product-images.repository.js";

const SECTION_ID = "default";
const DEFAULT_SECTION = {
  id: SECTION_ID,
  name: "Featured Products",
  heading: "Shop Featured Products",
  isActive: true,
  updatedAt: null,
};

function mapSection(row) {
  if (!row) {
    return DEFAULT_SECTION;
  }

  return {
    id: row.id,
    name: row.name ?? DEFAULT_SECTION.name,
    heading: row.heading ?? DEFAULT_SECTION.heading,
    isActive: Boolean(row.isActive),
    updatedAt: toIsoString(row.updatedAt),
  };
}

async function getHomepageProductSection(connection = getPool()) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        name,
        heading,
        is_active AS isActive,
        updated_at AS updatedAt
      FROM homepage_product_section
      WHERE id = ?
      LIMIT 1
    `,
    [SECTION_ID],
  );

  return mapSection(rows[0]);
}

export async function getHomepageProducts(includeHidden = true) {
  const section = await getHomepageProductSection();
  const [rows] = await getPool().query(
    `
      SELECT
        hp.id,
        hp.product_id AS productId,
        hp.position,
        hp.is_active AS isActive,
        hp.created_at AS createdAt,
        hp.updated_at AS updatedAt,
        p.id AS productIdRef,
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
        p.is_active AS productIsActive,
        p.created_at AS productCreatedAt,
        p.updated_at AS productUpdatedAt,
        c.id AS categoryIdRef,
        c.name AS categoryName,
        c.slug AS categorySlug
      FROM homepage_products hp
      JOIN products p ON p.id = hp.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      ${includeHidden ? "" : "WHERE hp.is_active = 1"}
      ORDER BY hp.position ASC, hp.created_at ASC
    `,
  );

  const productIds = rows.map((row) => row.productIdRef).filter(Boolean);
  const imageRows = await findProductImageRowsByProductIds(productIds);
  const imagesByProductId = groupProductImageRowsByProductId(imageRows);

  const items = rows.map((row, index) => ({
    id: row.id,
    productId: row.productId,
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
        badge: row.badge,
        subtitle: row.subtitle,
        categoryId: row.categoryId,
        price: row.price,
        originalPrice: row.originalPrice,
        offerPrice: row.offerPrice,
        ratingAvg: row.ratingAvg,
        reviewCount: row.reviewCount,
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

  return {
    section,
    items,
  };
}

export async function replaceHomepageProducts(input) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const now = new Date();
    await connection.query(
      `
        INSERT INTO homepage_product_section (
          id,
          name,
          heading,
          is_active,
          updated_at
        ) VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          heading = VALUES(heading),
          is_active = VALUES(is_active),
          updated_at = VALUES(updated_at)
      `,
      [SECTION_ID, input.section.name, input.section.heading, input.section.isActive ? 1 : 0, now],
    );

    await connection.query("DELETE FROM homepage_products");
    for (const [index, entry] of input.items.entries()) {
      await connection.query(
        `
          INSERT INTO homepage_products (
            id,
            product_id,
            position,
            is_active,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          createId("hmp"),
          entry.productId,
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

  return getHomepageProducts(true);
}
