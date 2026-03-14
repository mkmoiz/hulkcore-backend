import { createId } from "../utils.js";
import { getPool } from "../db/connection.js";
import { mapLevel, mapLevelProduct } from "../mappers/level.mapper.js";
import { mapProduct } from "../mappers/product.mapper.js";
import { normalizeIdArray, normalizeText } from "../utils/normalize.js";
import { findProductImageRowsByProductIds, groupProductImageRowsByProductId } from "./product-images.repository.js";

function levelSelectSql(whereClause = "") {
  return `
    SELECT
      id,
      slug,
      name,
      description,
      image_url AS imageUrl,
      image_key AS imageKey,
      position,
      is_active AS isActive,
      rule_mode AS ruleMode,
      sort_mode AS sortMode,
      include_category_ids_json AS includeCategoryIdsJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM levels
    ${whereClause}
  `;
}

async function findLevelProductRowsByLevelIds(levelIds, connection = getPool()) {
  if (!Array.isArray(levelIds) || levelIds.length === 0) {
    return [];
  }

  const [rows] = await connection.query(
    `
      SELECT
        lp.id,
        lp.level_id AS levelId,
        lp.product_id AS productId,
        lp.position,
        lp.is_pinned AS isPinned,
        lp.created_at AS createdAt,
        lp.updated_at AS updatedAt,
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
        p.stock,
        p.is_active AS productIsActive,
        p.created_at AS productCreatedAt,
        p.updated_at AS productUpdatedAt,
        c.id AS categoryIdRef,
        c.name AS categoryName,
        c.slug AS categorySlug
      FROM level_products lp
      JOIN products p ON p.id = lp.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE lp.level_id IN (?)
      ORDER BY lp.level_id ASC, lp.is_pinned DESC, lp.position ASC, lp.created_at ASC
    `,
    [levelIds],
  );

  return rows;
}

function toMappedProductFromJoinedRow(row, imagesByProductId) {
  return mapProduct(
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
      stock: row.stock,
      isActive: row.productIsActive,
      createdAt: row.productCreatedAt,
      updatedAt: row.productUpdatedAt,
      categoryIdRef: row.categoryIdRef,
      categoryName: row.categoryName,
      categorySlug: row.categorySlug,
    },
    imagesByProductId[row.productIdRef] ?? [],
  );
}

async function attachLevelProducts(levels, connection = getPool()) {
  if (!Array.isArray(levels) || levels.length === 0) {
    return [];
  }

  const levelIds = levels.map((level) => level.id);
  const levelProductRows = await findLevelProductRowsByLevelIds(levelIds, connection);
  const productIds = Array.from(new Set(levelProductRows.map((row) => row.productIdRef).filter(Boolean)));
  const imageRows = await findProductImageRowsByProductIds(productIds, connection);
  const imagesByProductId = groupProductImageRowsByProductId(imageRows);

  const assignmentsByLevelId = levelProductRows.reduce((acc, row) => {
    const product = toMappedProductFromJoinedRow(row, imagesByProductId);
    const mappedAssignment = mapLevelProduct(row, product);
    if (!mappedAssignment) {
      return acc;
    }

    if (!acc[mappedAssignment.levelId]) {
      acc[mappedAssignment.levelId] = [];
    }
    acc[mappedAssignment.levelId].push(mappedAssignment);
    return acc;
  }, {});

  return levels.map((level) => ({
    ...level,
    levelProducts: (assignmentsByLevelId[level.id] ?? [])
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        if (a.position !== b.position) {
          return a.position - b.position;
        }
        return a.createdAt.localeCompare(b.createdAt);
      })
      .map((entry, index) => ({
        ...entry,
        position: index,
      })),
  }));
}

export async function getLevels(includeHidden = true) {
  const [rows] = await getPool().query(
    `${levelSelectSql(includeHidden ? "" : "WHERE is_active = 1")} ORDER BY position ASC, created_at ASC`,
  );
  const mappedLevels = rows.map(mapLevel).filter(Boolean);
  return attachLevelProducts(mappedLevels);
}

export async function findLevelById(id) {
  const [rows] = await getPool().query(
    `${levelSelectSql("WHERE id = ?")} LIMIT 1`,
    [id],
  );
  const level = mapLevel(rows[0]);
  if (!level) {
    return null;
  }

  const [withProducts] = await Promise.all([attachLevelProducts([level])]);
  return withProducts ?? null;
}

export async function findLevelBySlug(slug, includeHidden = true) {
  const whereClause = includeHidden ? "WHERE slug = ?" : "WHERE slug = ? AND is_active = 1";
  const [rows] = await getPool().query(
    `${levelSelectSql(whereClause)} LIMIT 1`,
    [slug],
  );
  const level = mapLevel(rows[0]);
  if (!level) {
    return null;
  }

  const [withProducts] = await Promise.all([attachLevelProducts([level])]);
  return withProducts ?? null;
}

export async function findLevelByName(name, excludeId) {
  const params = [name];
  let sql = `${levelSelectSql("WHERE LOWER(name) = LOWER(?)")}`;
  if (excludeId) {
    sql += " AND id <> ?";
    params.push(excludeId);
  }

  sql += " LIMIT 1";
  const [rows] = await getPool().query(sql, params);
  return mapLevel(rows[0]);
}

export async function createLevel(input) {
  const now = new Date();
  const includeCategoryIds = Array.from(new Set(normalizeIdArray(input?.includeCategoryIds)));
  await getPool().query(
    `
      INSERT INTO levels (
        id,
        slug,
        name,
        description,
        image_url,
        image_key,
        position,
        is_active,
        rule_mode,
        sort_mode,
        include_category_ids_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.id,
      input.slug,
      input.name,
      input.description ?? "",
      input.imageUrl ?? "",
      input.imageKey ?? "",
      input.position ?? 0,
      input.isActive ? 1 : 0,
      input.ruleMode === "DYNAMIC" ? "DYNAMIC" : "CURATED",
      input.sortMode ?? "featured",
      JSON.stringify(includeCategoryIds),
      now,
      now,
    ],
  );

  return findLevelById(input.id);
}

export async function updateLevelById(id, input) {
  const now = new Date();
  const includeCategoryIds = Array.from(new Set(normalizeIdArray(input?.includeCategoryIds)));
  const [result] = await getPool().query(
    `
      UPDATE levels
      SET
        slug = ?,
        name = ?,
        description = ?,
        image_url = ?,
        image_key = ?,
        position = ?,
        is_active = ?,
        rule_mode = ?,
        sort_mode = ?,
        include_category_ids_json = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [
      input.slug,
      input.name,
      input.description ?? "",
      input.imageUrl ?? "",
      input.imageKey ?? "",
      input.position ?? 0,
      input.isActive ? 1 : 0,
      input.ruleMode === "DYNAMIC" ? "DYNAMIC" : "CURATED",
      input.sortMode ?? "featured",
      JSON.stringify(includeCategoryIds),
      now,
      id,
    ],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findLevelById(id);
}

export async function deleteLevelById(id) {
  const [result] = await getPool().query(
    `
      DELETE FROM levels
      WHERE id = ?
    `,
    [id],
  );

  return result.affectedRows > 0;
}

export async function replaceLevelProductAssignments(levelId, entries) {
  const normalizedLevelId = normalizeText(levelId);
  if (!normalizedLevelId) {
    throw new Error("Level id is required.");
  }

  const normalizedEntries = Array.isArray(entries) ? entries : [];
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `
        DELETE FROM level_products
        WHERE level_id = ?
      `,
      [normalizedLevelId],
    );

    const now = new Date();
    for (const [index, entry] of normalizedEntries.entries()) {
      const productId = normalizeText(entry?.productId);
      if (!productId) {
        continue;
      }

      const positionCandidate = Number(entry?.position);
      const position =
        Number.isInteger(positionCandidate) && positionCandidate >= 0
          ? positionCandidate
          : index;

      await connection.query(
        `
          INSERT INTO level_products (
            id,
            level_id,
            product_id,
            position,
            is_pinned,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          createId("lvp"),
          normalizedLevelId,
          productId,
          position,
          entry?.isPinned ? 1 : 0,
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

  return findLevelById(normalizedLevelId);
}
