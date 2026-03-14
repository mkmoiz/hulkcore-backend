import { createId } from "../utils.js";
import { getPool } from "../db/connection.js";
import { mapCart } from "../mappers/cart.mapper.js";
import { createStoreError } from "../utils/errors.js";
import { normalizeCustomerRef } from "../utils/normalize.js";

export async function findActiveCartRowByCustomerRef(customerRef, connection = getPool()) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        customer_ref AS customerRef,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM carts
      WHERE customer_ref = ? AND status = 'active'
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [customerRef],
  );

  return rows[0] ?? null;
}

export async function findCartRowById(cartId, connection = getPool()) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        customer_ref AS customerRef,
        status,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM carts
      WHERE id = ?
      LIMIT 1
    `,
    [cartId],
  );

  return rows[0] ?? null;
}

export async function findCartItemRowsByCartId(cartId, connection = getPool()) {
  const [rows] = await connection.query(
    `
      SELECT
        ci.id,
        ci.cart_id AS cartId,
        ci.product_id AS productId,
        ci.quantity,
        ci.unit_price AS unitPrice,
        (ci.quantity * ci.unit_price) AS lineTotal,
        ci.created_at AS createdAt,
        ci.updated_at AS updatedAt,
        p.name AS productName,
        p.description AS productDescription,
        p.image_url AS productImageUrl,
        p.sku AS productSku,
        p.stock AS productStock,
        p.is_active AS productIsActive,
        c.id AS categoryId,
        c.name AS categoryName
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE ci.cart_id = ?
      ORDER BY ci.created_at ASC
    `,
    [cartId],
  );

  return rows;
}

export async function findCartComboItemRowsByCartId(cartId, connection = getPool()) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        cart_id AS cartId,
        combo_offer_id AS comboOfferId,
        combo_title AS comboTitle,
        banner_image_url AS bannerImageUrl,
        products_json AS productsJson,
        quantity,
        unit_price AS unitPrice,
        (quantity * unit_price) AS lineTotal,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM cart_combo_items
      WHERE cart_id = ?
      ORDER BY created_at ASC
    `,
    [cartId],
  );

  return rows;
}

export async function touchCart(cartId, connection = getPool()) {
  const now = new Date();
  await connection.query(
    `
      UPDATE carts
      SET updated_at = ?
      WHERE id = ?
    `,
    [now, cartId],
  );
}

export async function createActiveCartRow(customerRef, connection = getPool()) {
  const now = new Date();
  const cartId = createId("cart");

  await connection.query(
    `
      INSERT INTO carts (
        id,
        customer_ref,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, 'active', ?, ?)
    `,
    [cartId, customerRef, now, now],
  );

  return findCartRowById(cartId, connection);
}

export async function getOrCreateActiveCartRow(customerRef, connection = getPool()) {
  const normalizedCustomerRef = normalizeCustomerRef(customerRef);
  if (!normalizedCustomerRef) {
    throw createStoreError("Customer reference is required.", "CART_CUSTOMER_REF_REQUIRED", 400);
  }

  const existingCart = await findActiveCartRowByCustomerRef(normalizedCustomerRef, connection);
  if (existingCart) {
    return existingCart;
  }

  return createActiveCartRow(normalizedCustomerRef, connection);
}

export async function getCartById(cartId, connection = getPool()) {
  const cartRow = await findCartRowById(cartId, connection);
  if (!cartRow) {
    return null;
  }

  const [cartItemRows, cartComboRows] = await Promise.all([
    findCartItemRowsByCartId(cartId, connection),
    findCartComboItemRowsByCartId(cartId, connection),
  ]);
  return mapCart(cartRow, cartItemRows, cartComboRows);
}

export async function findExistingCartItemRow(cartId, productId) {
  const [rows] = await getPool().query(
    `
      SELECT id, quantity
      FROM cart_items
      WHERE cart_id = ? AND product_id = ?
      LIMIT 1
    `,
    [cartId, productId],
  );

  return rows[0] ?? null;
}

export async function findExistingCartComboItemRow(cartId, comboOfferId) {
  const [rows] = await getPool().query(
    `
      SELECT id, quantity
      FROM cart_combo_items
      WHERE cart_id = ? AND combo_offer_id = ?
      LIMIT 1
    `,
    [cartId, comboOfferId],
  );

  return rows[0] ?? null;
}

export async function findCartItemForCart(itemId, cartId) {
  const [rows] = await getPool().query(
    `
      SELECT id, product_id AS productId
      FROM cart_items
      WHERE id = ? AND cart_id = ?
      LIMIT 1
    `,
    [itemId, cartId],
  );

  return rows[0] ?? null;
}

export async function findCartComboItemForCart(itemId, cartId) {
  const [rows] = await getPool().query(
    `
      SELECT id, combo_offer_id AS comboOfferId
      FROM cart_combo_items
      WHERE id = ? AND cart_id = ?
      LIMIT 1
    `,
    [itemId, cartId],
  );

  return rows[0] ?? null;
}

export async function updateCartItemRow(itemId, quantity, unitPrice, now = new Date()) {
  await getPool().query(
    `
      UPDATE cart_items
      SET quantity = ?, unit_price = ?, updated_at = ?
      WHERE id = ?
    `,
    [quantity, unitPrice, now, itemId],
  );
}

export async function updateCartComboItemRow(itemId, quantity, unitPrice, now = new Date()) {
  await getPool().query(
    `
      UPDATE cart_combo_items
      SET quantity = ?, unit_price = ?, updated_at = ?
      WHERE id = ?
    `,
    [quantity, unitPrice, now, itemId],
  );
}

export async function insertCartItemRow(entry, now = new Date()) {
  await getPool().query(
    `
      INSERT INTO cart_items (
        id,
        cart_id,
        product_id,
        quantity,
        unit_price,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [entry.id, entry.cartId, entry.productId, entry.quantity, entry.unitPrice, now, now],
  );
}

export async function insertCartComboItemRow(entry, now = new Date()) {
  await getPool().query(
    `
      INSERT INTO cart_combo_items (
        id,
        cart_id,
        combo_offer_id,
        combo_title,
        banner_image_url,
        products_json,
        quantity,
        unit_price,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      entry.id,
      entry.cartId,
      entry.comboOfferId,
      entry.comboTitle,
      entry.bannerImageUrl,
      entry.productsJson,
      entry.quantity,
      entry.unitPrice,
      now,
      now,
    ],
  );
}

export async function deleteCartItemById(itemId) {
  await getPool().query(
    `
      DELETE FROM cart_items
      WHERE id = ?
    `,
    [itemId],
  );
}

export async function deleteCartComboItemByIdAndCartId(itemId, cartId) {
  const [result] = await getPool().query(
    `
      DELETE FROM cart_combo_items
      WHERE id = ? AND cart_id = ?
    `,
    [itemId, cartId],
  );

  return result.affectedRows > 0;
}

export async function deleteCartItemByIdAndCartId(itemId, cartId) {
  const [result] = await getPool().query(
    `
      DELETE FROM cart_items
      WHERE id = ? AND cart_id = ?
    `,
    [itemId, cartId],
  );

  return result.affectedRows > 0;
}

export async function markCartCheckedOut(cartId, now, connection = getPool()) {
  await connection.query(
    `
      UPDATE carts
      SET status = 'checked_out', updated_at = ?
      WHERE id = ?
    `,
    [now, cartId],
  );
}
