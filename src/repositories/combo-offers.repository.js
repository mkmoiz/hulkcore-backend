import { getPool } from "../db/connection.js";
import { toIsoString } from "../utils/dates.js";
import { normalizeText } from "../utils/normalize.js";
import { createId } from "../utils.js";

function toRounded(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) {
    return 0;
  }

  return Number(num.toFixed(2));
}

export function deriveComboOfferStatus(input, now = new Date()) {
  const isActive = Boolean(input?.isActive);
  const startDate = input?.startDate ? new Date(input.startDate) : null;
  const endDate = input?.endDate ? new Date(input.endDate) : null;
  const timeNow = now instanceof Date ? now.getTime() : Date.now();
  const startTime = startDate && Number.isFinite(startDate.getTime()) ? startDate.getTime() : null;
  const endTime = endDate && Number.isFinite(endDate.getTime()) ? endDate.getTime() : null;

  if (!isActive) {
    return "draft";
  }
  if (startTime && timeNow < startTime) {
    return "scheduled";
  }
  if (endTime && timeNow > endTime) {
    return "expired";
  }

  return "active";
}

function toComboProduct(row, fallbackPosition = 0) {
  return {
    productId: row.productId,
    position: Number(row.position ?? fallbackPosition),
    name: row.productName ?? "",
    imageUrl: row.productImageUrl ?? "",
    price: Number(row.offerPrice ?? row.price ?? 0),
    originalPrice: Number(row.originalPrice ?? row.price ?? 0),
    offerPrice: Number(row.offerPrice ?? row.price ?? 0),
    isActive: Boolean(row.productIsActive),
  };
}

function toComboOffer(row, products, now = new Date()) {
  const sortedProducts = [...products]
    .sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0))
    .map((entry, index) => ({
      ...entry,
      position: index,
    }));

  const totalOriginalPrice = toRounded(
    sortedProducts.reduce((acc, product) => acc + Number(product.price ?? 0), 0),
  );
  const offerPrice = toRounded(row.offerPrice);
  const saveAmount = toRounded(Math.max(0, totalOriginalPrice - offerPrice));
  const discountPercentage =
    totalOriginalPrice > 0 ? toRounded((saveAmount / totalOriginalPrice) * 100) : 0;
  const startDate = row.startDate ? toIsoString(row.startDate) : null;
  const endDate = row.endDate ? toIsoString(row.endDate) : null;

  return {
    id: row.id,
    title: row.title ?? "",
    bannerImageUrl: row.bannerImageUrl ?? "",
    bannerImageKey: row.bannerImageKey ?? "",
    description: row.description ?? "",
    offerPrice,
    totalOriginalPrice,
    discountPercentage,
    saveAmount,
    position: Number(row.position ?? 0),
    salesCount: Number(row.salesCount ?? 0),
    isActive: Boolean(row.isActive),
    status: deriveComboOfferStatus(
      {
        isActive: Boolean(row.isActive),
        startDate,
        endDate,
      },
      now,
    ),
    startDate,
    endDate,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    products: sortedProducts,
  };
}

async function findComboOfferRows(includeHidden = true, connection = getPool()) {
  const [rows] = await connection.query(
    `
      SELECT
        co.id,
        co.title,
        co.banner_image_url AS bannerImageUrl,
        co.banner_image_key AS bannerImageKey,
        co.description,
        co.offer_price AS offerPrice,
        co.position,
        co.is_active AS isActive,
        co.start_at AS startDate,
        co.end_at AS endDate,
        COALESCE(
          (
            SELECT SUM(oci.quantity)
            FROM order_combo_items oci
            WHERE oci.combo_offer_id = co.id
          ),
          0
        ) AS salesCount,
        co.created_at AS createdAt,
        co.updated_at AS updatedAt
      FROM combo_offers co
      ${
        includeHidden
          ? ""
          : "WHERE co.is_active = 1 AND (co.start_at IS NULL OR co.start_at <= NOW()) AND (co.end_at IS NULL OR co.end_at >= NOW())"
      }
      ORDER BY co.position ASC, co.created_at DESC
    `,
  );

  return rows;
}

async function findComboOfferProductsByOfferIds(offerIds, connection = getPool()) {
  if (!Array.isArray(offerIds) || offerIds.length === 0) {
    return [];
  }

  const [rows] = await connection.query(
    `
      SELECT
        cop.combo_offer_id AS comboOfferId,
        cop.product_id AS productId,
        cop.position,
        p.name AS productName,
        p.image_url AS productImageUrl,
        p.price,
        p.original_price AS originalPrice,
        p.offer_price AS offerPrice,
        p.is_active AS productIsActive
      FROM combo_offer_products cop
      JOIN products p ON p.id = cop.product_id
      WHERE cop.combo_offer_id IN (?)
      ORDER BY cop.combo_offer_id ASC, cop.position ASC, cop.created_at ASC
    `,
    [offerIds],
  );

  return rows;
}

export async function getComboOffers(includeHidden = true) {
  const rows = await findComboOfferRows(includeHidden);
  if (rows.length === 0) {
    return [];
  }

  const comboOfferIds = rows.map((row) => row.id);
  const productRows = await findComboOfferProductsByOfferIds(comboOfferIds);
  const productsByOfferId = productRows.reduce((acc, row) => {
    if (!acc[row.comboOfferId]) {
      acc[row.comboOfferId] = [];
    }

    acc[row.comboOfferId].push(toComboProduct(row, acc[row.comboOfferId].length));
    return acc;
  }, {});

  const now = new Date();
  return rows.map((row, index) =>
    toComboOffer(
      {
        ...row,
        position: Number(row.position ?? index),
      },
      productsByOfferId[row.id] ?? [],
      now,
    ),
  );
}

export async function findComboOfferById(id, includeHidden = true) {
  const comboOfferId = normalizeText(id);
  if (!comboOfferId) {
    return null;
  }

  const [rows] = await getPool().query(
    `
      SELECT
        co.id,
        co.title,
        co.banner_image_url AS bannerImageUrl,
        co.banner_image_key AS bannerImageKey,
        co.description,
        co.offer_price AS offerPrice,
        co.position,
        co.is_active AS isActive,
        co.start_at AS startDate,
        co.end_at AS endDate,
        COALESCE(
          (
            SELECT SUM(oci.quantity)
            FROM order_combo_items oci
            WHERE oci.combo_offer_id = co.id
          ),
          0
        ) AS salesCount,
        co.created_at AS createdAt,
        co.updated_at AS updatedAt
      FROM combo_offers co
      WHERE co.id = ?
      LIMIT 1
    `,
    [comboOfferId],
  );
  const row = rows[0];
  if (!row) {
    return null;
  }

  const productRows = await findComboOfferProductsByOfferIds([comboOfferId]);
  const products = productRows.map((entry, index) => toComboProduct(entry, index));
  const offer = toComboOffer(row, products);
  if (!includeHidden && offer.status !== "active") {
    return null;
  }

  return offer;
}

function toDbDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date;
}

async function nextComboOfferPosition(connection = getPool()) {
  const [rows] = await connection.query(
    `
      SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition
      FROM combo_offers
    `,
  );

  return Number(rows?.[0]?.nextPosition ?? 0);
}

export async function createComboOffer(input) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const comboOfferId = createId("cbo");
    const now = new Date();
    const position = await nextComboOfferPosition(connection);
    const startDate = toDbDate(input?.startDate);
    const endDate = toDbDate(input?.endDate);

    await connection.query(
      `
        INSERT INTO combo_offers (
          id,
          title,
          banner_image_url,
          banner_image_key,
          description,
          offer_price,
          position,
          is_active,
          start_at,
          end_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        comboOfferId,
        input.title,
        input.bannerImageUrl,
        input.bannerImageKey ?? "",
        input.description ?? "",
        Number(input.offerPrice ?? 0),
        position,
        input.isActive ? 1 : 0,
        startDate,
        endDate,
        now,
        now,
      ],
    );

    for (const [index, productId] of input.productIds.entries()) {
      await connection.query(
        `
          INSERT INTO combo_offer_products (
            id,
            combo_offer_id,
            product_id,
            position,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [createId("cbop"), comboOfferId, productId, index, now, now],
      );
    }

    await connection.commit();
    return findComboOfferById(comboOfferId, true);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateComboOfferById(id, input) {
  const comboOfferId = normalizeText(id);
  if (!comboOfferId) {
    return null;
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `
        SELECT id
        FROM combo_offers
        WHERE id = ?
        LIMIT 1
      `,
      [comboOfferId],
    );
    if (existingRows.length === 0) {
      await connection.rollback();
      return null;
    }

    const now = new Date();
    const startDate = toDbDate(input?.startDate);
    const endDate = toDbDate(input?.endDate);

    await connection.query(
      `
        UPDATE combo_offers
        SET
          title = ?,
          banner_image_url = ?,
          banner_image_key = ?,
          description = ?,
          offer_price = ?,
          is_active = ?,
          start_at = ?,
          end_at = ?,
          updated_at = ?
        WHERE id = ?
        LIMIT 1
      `,
      [
        input.title,
        input.bannerImageUrl,
        input.bannerImageKey ?? "",
        input.description ?? "",
        Number(input.offerPrice ?? 0),
        input.isActive ? 1 : 0,
        startDate,
        endDate,
        now,
        comboOfferId,
      ],
    );

    await connection.query(
      `
        DELETE FROM combo_offer_products
        WHERE combo_offer_id = ?
      `,
      [comboOfferId],
    );

    for (const [index, productId] of input.productIds.entries()) {
      await connection.query(
        `
          INSERT INTO combo_offer_products (
            id,
            combo_offer_id,
            product_id,
            position,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [createId("cbop"), comboOfferId, productId, index, now, now],
      );
    }

    await connection.commit();
    return findComboOfferById(comboOfferId, true);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteComboOfferById(id) {
  const comboOfferId = normalizeText(id);
  if (!comboOfferId) {
    return false;
  }

  const [result] = await getPool().query(
    `
      DELETE FROM combo_offers
      WHERE id = ?
      LIMIT 1
    `,
    [comboOfferId],
  );

  return result.affectedRows > 0;
}

export async function duplicateComboOfferById(id) {
  const existing = await findComboOfferById(id, true);
  if (!existing) {
    return null;
  }

  const nextTitle = `${existing.title} (Copy)`.slice(0, 191);
  return createComboOffer({
    title: nextTitle,
    bannerImageUrl: existing.bannerImageUrl,
    bannerImageKey: existing.bannerImageKey,
    description: existing.description,
    offerPrice: existing.offerPrice,
    isActive: false,
    startDate: null,
    endDate: null,
    productIds: existing.products.map((entry) => entry.productId),
  });
}
