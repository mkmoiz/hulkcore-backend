import { getPool } from "../db/connection.js";
import { mapOrder } from "../mappers/order.mapper.js";
import { normalizeCustomerRef, normalizeText } from "../utils/normalize.js";
import { toIsoString } from "../utils/dates.js";

export async function findOrderItemRowsByOrderId(orderId, connection = getPool()) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        order_id AS orderId,
        product_id AS productId,
        product_name AS productName,
        quantity,
        unit_price AS unitPrice,
        line_total AS lineTotal,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM order_items
      WHERE order_id = ?
      ORDER BY created_at ASC
    `,
    [orderId],
  );

  return rows.map((row) => ({
    id: row.id,
    orderId: row.orderId,
    productId: row.productId,
    productName: row.productName,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unitPrice),
    lineTotal: Number(row.lineTotal),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }));
}

export async function findOrderComboItemRowsByOrderId(orderId, connection = getPool()) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        order_id AS orderId,
        combo_offer_id AS comboOfferId,
        combo_title AS comboTitle,
        combo_description AS comboDescription,
        banner_image_url AS bannerImageUrl,
        products_json AS productsJson,
        quantity,
        unit_price AS unitPrice,
        line_total AS lineTotal,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM order_combo_items
      WHERE order_id = ?
      ORDER BY created_at ASC
    `,
    [orderId],
  );

  return rows.map((row) => {
    let products = [];
    if (typeof row.productsJson === "string" && row.productsJson.trim()) {
      try {
        const parsed = JSON.parse(row.productsJson);
        if (Array.isArray(parsed)) {
          products = parsed;
        }
      } catch {
        products = [];
      }
    }

    return {
      id: row.id,
      orderId: row.orderId,
      comboOfferId: row.comboOfferId,
      comboTitle: row.comboTitle ?? "",
      comboDescription: row.comboDescription ?? "",
      bannerImageUrl: row.bannerImageUrl ?? "",
      products,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unitPrice),
      lineTotal: Number(row.lineTotal),
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
    };
  });
}

export async function findOrderRowById(orderId) {
  const [rows] = await getPool().query(
    `
      SELECT
        id,
        cart_id AS cartId,
        customer_ref AS customerRef,
        customer_name AS customerName,
        customer_email AS customerEmail,
        customer_phone AS customerPhone,
        shipping_address_json AS shippingAddressJson,
        payment_method AS paymentMethod,
        payment_status AS paymentStatus,
        payment_gateway AS paymentGateway,
        gateway_order_id AS gatewayOrderId,
        gateway_payment_id AS gatewayPaymentId,
        gateway_signature AS gatewaySignature,
        fulfillment_provider AS fulfillmentProvider,
        fulfillment_order_id AS fulfillmentOrderId,
        fulfillment_shipment_id AS fulfillmentShipmentId,
        fulfillment_awb_code AS fulfillmentAwbCode,
        fulfillment_courier_name AS fulfillmentCourierName,
        fulfillment_status AS fulfillmentStatus,
        fulfillment_synced_at AS fulfillmentSyncedAt,
        fulfillment_payload_json AS fulfillmentPayloadJson,
        currency,
        status,
        subtotal,
        shipping_fee AS shippingFee,
        total,
        placed_at AS placedAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM orders
      WHERE id = ?
      LIMIT 1
    `,
    [orderId],
  );

  return rows[0] ?? null;
}

export async function findOrderById(id) {
  const order = mapOrder(await findOrderRowById(id));
  if (!order) {
    return null;
  }

  const [items, comboItems] = await Promise.all([
    findOrderItemRowsByOrderId(order.id),
    findOrderComboItemRowsByOrderId(order.id),
  ]);
  return {
    ...order,
    items,
    comboItems,
  };
}

export async function findOrderByGatewayPaymentId(gatewayPaymentId, paymentGateway = "razorpay") {
  const normalizedGatewayPaymentId = normalizeText(gatewayPaymentId);
  const normalizedGateway = normalizeText(paymentGateway).toLowerCase();

  if (!normalizedGatewayPaymentId || !normalizedGateway) {
    return null;
  }

  const [rows] = await getPool().query(
    `
      SELECT id
      FROM orders
      WHERE payment_gateway = ? AND gateway_payment_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [normalizedGateway, normalizedGatewayPaymentId],
  );

  const orderId = normalizeText(rows[0]?.id);
  if (!orderId) {
    return null;
  }

  return findOrderById(orderId);
}

export async function findOrderByGatewayOrderId(gatewayOrderId, paymentGateway = "razorpay") {
  const normalizedGatewayOrderId = normalizeText(gatewayOrderId);
  const normalizedGateway = normalizeText(paymentGateway).toLowerCase();

  if (!normalizedGatewayOrderId || !normalizedGateway) {
    return null;
  }

  const [rows] = await getPool().query(
    `
      SELECT id
      FROM orders
      WHERE payment_gateway = ? AND gateway_order_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [normalizedGateway, normalizedGatewayOrderId],
  );

  const orderId = normalizeText(rows[0]?.id);
  if (!orderId) {
    return null;
  }

  return findOrderById(orderId);
}

export async function getOrdersByCustomerRef(customerRef) {
  const normalizedCustomerRef = normalizeCustomerRef(customerRef);
  if (!normalizedCustomerRef) {
    return [];
  }

  const [rows] = await getPool().query(
    `
      SELECT
        id,
        cart_id AS cartId,
        customer_ref AS customerRef,
        customer_name AS customerName,
        customer_email AS customerEmail,
        customer_phone AS customerPhone,
        shipping_address_json AS shippingAddressJson,
        payment_method AS paymentMethod,
        payment_status AS paymentStatus,
        payment_gateway AS paymentGateway,
        gateway_order_id AS gatewayOrderId,
        gateway_payment_id AS gatewayPaymentId,
        gateway_signature AS gatewaySignature,
        fulfillment_provider AS fulfillmentProvider,
        fulfillment_order_id AS fulfillmentOrderId,
        fulfillment_shipment_id AS fulfillmentShipmentId,
        fulfillment_awb_code AS fulfillmentAwbCode,
        fulfillment_courier_name AS fulfillmentCourierName,
        fulfillment_status AS fulfillmentStatus,
        fulfillment_synced_at AS fulfillmentSyncedAt,
        fulfillment_payload_json AS fulfillmentPayloadJson,
        currency,
        status,
        subtotal,
        shipping_fee AS shippingFee,
        total,
        placed_at AS placedAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM orders
      WHERE customer_ref = ?
      ORDER BY placed_at DESC
      LIMIT 25
    `,
    [normalizedCustomerRef],
  );

  const orders = rows.map(mapOrder);
  const withItems = await Promise.all(
    orders.map(async (order) => ({
      ...order,
      items: await findOrderItemRowsByOrderId(order.id),
      comboItems: await findOrderComboItemRowsByOrderId(order.id),
    })),
  );

  return withItems;
}

export async function getOrdersForAdmin(options = {}) {
  const normalizedStatus = normalizeText(options?.status).toLowerCase();
  const normalizedPaymentStatus = normalizeText(options?.paymentStatus).toLowerCase();
  const parsedLimit = Number(options?.limit);
  const parsedOffset = Number(options?.offset);
  const limit = Number.isInteger(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 200)) : 50;
  const offset = Number.isInteger(parsedOffset) ? Math.max(0, parsedOffset) : 0;

  const filters = [];
  const filterParams = [];
  if (normalizedStatus) {
    filters.push("status = ?");
    filterParams.push(normalizedStatus);
  }
  if (normalizedPaymentStatus) {
    filters.push("payment_status = ?");
    filterParams.push(normalizedPaymentStatus);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

  const [totalRows] = await getPool().query(
    `
      SELECT COUNT(*) AS total
      FROM orders
      ${whereClause}
    `,
    [...filterParams],
  );
  const total = Number(totalRows?.[0]?.total ?? 0);

  const [rows] = await getPool().query(
    `
      SELECT
        id,
        cart_id AS cartId,
        customer_ref AS customerRef,
        customer_name AS customerName,
        customer_email AS customerEmail,
        customer_phone AS customerPhone,
        shipping_address_json AS shippingAddressJson,
        payment_method AS paymentMethod,
        payment_status AS paymentStatus,
        payment_gateway AS paymentGateway,
        gateway_order_id AS gatewayOrderId,
        gateway_payment_id AS gatewayPaymentId,
        gateway_signature AS gatewaySignature,
        fulfillment_provider AS fulfillmentProvider,
        fulfillment_order_id AS fulfillmentOrderId,
        fulfillment_shipment_id AS fulfillmentShipmentId,
        fulfillment_awb_code AS fulfillmentAwbCode,
        fulfillment_courier_name AS fulfillmentCourierName,
        fulfillment_status AS fulfillmentStatus,
        fulfillment_synced_at AS fulfillmentSyncedAt,
        fulfillment_payload_json AS fulfillmentPayloadJson,
        currency,
        status,
        subtotal,
        shipping_fee AS shippingFee,
        total,
        placed_at AS placedAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM orders
      ${whereClause}
      ORDER BY placed_at DESC
      LIMIT ?
      OFFSET ?
    `,
    [...filterParams, limit, offset],
  );

  const orders = rows.map(mapOrder);
  const withItems = await Promise.all(
    orders.map(async (order) => ({
      ...order,
      items: await findOrderItemRowsByOrderId(order.id),
      comboItems: await findOrderComboItemRowsByOrderId(order.id),
    })),
  );

  return {
    total,
    limit,
    offset,
    orders: withItems,
  };
}

export async function updateOrderById(orderId, input = {}) {
  const normalizedOrderId = normalizeText(orderId);
  if (!normalizedOrderId) {
    return null;
  }

  const normalizedStatus = normalizeText(input?.status).toLowerCase();
  const normalizedPaymentStatus = normalizeText(input?.paymentStatus).toLowerCase();
  const normalizedPaymentGateway = normalizeText(input?.paymentGateway).toLowerCase();
  const normalizedGatewayOrderId = normalizeText(input?.gatewayOrderId);
  const normalizedGatewayPaymentId = normalizeText(input?.gatewayPaymentId);
  const normalizedGatewaySignature = normalizeText(input?.gatewaySignature);
  const normalizedFulfillmentProvider = normalizeText(input?.fulfillmentProvider).toLowerCase();
  const normalizedFulfillmentOrderId = normalizeText(input?.fulfillmentOrderId);
  const normalizedFulfillmentShipmentId = normalizeText(input?.fulfillmentShipmentId);
  const normalizedFulfillmentAwbCode = normalizeText(input?.fulfillmentAwbCode);
  const normalizedFulfillmentCourierName = normalizeText(input?.fulfillmentCourierName);
  const normalizedFulfillmentStatus = normalizeText(input?.fulfillmentStatus).toLowerCase();
  const fulfillmentPayloadJson =
    input?.fulfillmentPayloadJson === null || typeof input?.fulfillmentPayloadJson === "string"
      ? input.fulfillmentPayloadJson
      : undefined;

  const updates = [];
  const params = [];
  if (normalizedStatus) {
    updates.push("status = ?");
    params.push(normalizedStatus);
  }
  if (normalizedPaymentStatus) {
    updates.push("payment_status = ?");
    params.push(normalizedPaymentStatus);
  }
  if (normalizedPaymentGateway) {
    updates.push("payment_gateway = ?");
    params.push(normalizedPaymentGateway);
  }
  if (normalizedGatewayOrderId) {
    updates.push("gateway_order_id = ?");
    params.push(normalizedGatewayOrderId);
  }
  if (normalizedGatewayPaymentId) {
    updates.push("gateway_payment_id = ?");
    params.push(normalizedGatewayPaymentId);
  }
  if (normalizedGatewaySignature) {
    updates.push("gateway_signature = ?");
    params.push(normalizedGatewaySignature);
  }
  if (normalizedFulfillmentProvider) {
    updates.push("fulfillment_provider = ?");
    params.push(normalizedFulfillmentProvider);
  }
  if (normalizedFulfillmentOrderId) {
    updates.push("fulfillment_order_id = ?");
    params.push(normalizedFulfillmentOrderId);
  }
  if (normalizedFulfillmentShipmentId) {
    updates.push("fulfillment_shipment_id = ?");
    params.push(normalizedFulfillmentShipmentId);
  }
  if (normalizedFulfillmentAwbCode) {
    updates.push("fulfillment_awb_code = ?");
    params.push(normalizedFulfillmentAwbCode);
  }
  if (normalizedFulfillmentCourierName) {
    updates.push("fulfillment_courier_name = ?");
    params.push(normalizedFulfillmentCourierName);
  }
  if (normalizedFulfillmentStatus) {
    updates.push("fulfillment_status = ?");
    params.push(normalizedFulfillmentStatus);
  }
  if (Object.prototype.hasOwnProperty.call(input, "fulfillmentSyncedAt")) {
    updates.push("fulfillment_synced_at = ?");
    params.push(input.fulfillmentSyncedAt || null);
  }
  if (fulfillmentPayloadJson !== undefined) {
    updates.push("fulfillment_payload_json = ?");
    params.push(fulfillmentPayloadJson);
  }

  if (updates.length === 0) {
    return findOrderById(normalizedOrderId);
  }

  const now = new Date();
  updates.push("updated_at = ?");
  params.push(now, normalizedOrderId);

  const [result] = await getPool().query(
    `
      UPDATE orders
      SET ${updates.join(", ")}
      WHERE id = ?
      LIMIT 1
    `,
    params,
  );

  if (!result?.affectedRows) {
    return null;
  }

  return findOrderById(normalizedOrderId);
}

export async function insertOrderRow(entry, connection = getPool()) {
  await connection.query(
    `
      INSERT INTO orders (
        id,
        cart_id,
        customer_ref,
        customer_name,
        customer_email,
        customer_phone,
        shipping_address_json,
        payment_method,
        payment_status,
        payment_gateway,
        gateway_order_id,
        gateway_payment_id,
        gateway_signature,
        fulfillment_provider,
        fulfillment_order_id,
        fulfillment_shipment_id,
        fulfillment_awb_code,
        fulfillment_courier_name,
        fulfillment_status,
        fulfillment_synced_at,
        fulfillment_payload_json,
        currency,
        status,
        subtotal,
        shipping_fee,
        total,
        placed_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      entry.orderId,
      entry.cartId,
      entry.customerRef,
      entry.customerName,
      entry.customerEmail,
      entry.customerPhone,
      entry.shippingAddressJson,
      entry.paymentMethod,
      entry.paymentStatus,
      entry.paymentGateway,
      entry.gatewayOrderId,
      entry.gatewayPaymentId,
      entry.gatewaySignature,
      entry.fulfillmentProvider || "",
      entry.fulfillmentOrderId || "",
      entry.fulfillmentShipmentId || "",
      entry.fulfillmentAwbCode || "",
      entry.fulfillmentCourierName || "",
      entry.fulfillmentStatus || "",
      entry.fulfillmentSyncedAt || null,
      entry.fulfillmentPayloadJson || null,
      entry.currency,
      entry.status,
      entry.subtotal,
      entry.shippingFee,
      entry.total,
      entry.now,
      entry.now,
      entry.now,
    ],
  );
}

export async function insertOrderItemRow(item, now, connection = getPool()) {
  await connection.query(
    `
      INSERT INTO order_items (
        id,
        order_id,
        product_id,
        product_name,
        quantity,
        unit_price,
        line_total,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      item.id,
      item.orderId,
      item.productId,
      item.productName,
      item.quantity,
      item.unitPrice,
      item.lineTotal,
      now,
      now,
    ],
  );
}

export async function insertOrderComboItemRow(item, now, connection = getPool()) {
  await connection.query(
    `
      INSERT INTO order_combo_items (
        id,
        order_id,
        combo_offer_id,
        combo_title,
        combo_description,
        banner_image_url,
        products_json,
        quantity,
        unit_price,
        line_total,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      item.id,
      item.orderId,
      item.comboOfferId,
      item.comboTitle,
      item.comboDescription,
      item.bannerImageUrl,
      item.productsJson,
      item.quantity,
      item.unitPrice,
      item.lineTotal,
      now,
      now,
    ],
  );
}

export async function decrementProductStock(productId, quantity, now, connection = getPool()) {
  await connection.query(
    `
      UPDATE products
      SET stock = stock - ?, updated_at = ?
      WHERE id = ?
    `,
    [quantity, now, productId],
  );
}

export async function findProductForCheckout(productId, connection = getPool()) {
  const [productRows] = await connection.query(
    `
      SELECT id, name, price, stock, is_active AS isActive
      FROM products
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [productId],
  );

  return productRows[0] ?? null;
}
