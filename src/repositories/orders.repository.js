import { getPrisma } from "../db/prisma.js";
import { mapOrder } from "../mappers/order.mapper.js";
import { normalizeCustomerRef, normalizeText } from "../utils/normalize.js";
import { toIsoString } from "../utils/dates.js";

export async function findOrderItemRowsByOrderId(orderId, prismaClient = getPrisma()) {
  const rows = await prismaClient.orderItem.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });

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

export async function findOrderComboItemRowsByOrderId(orderId, prismaClient = getPrisma()) {
  const rows = await prismaClient.orderComboItem.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });

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
  const row = await getPrisma().order.findUnique({
    where: { id: orderId },
  });

  return row ?? null;
}

export async function findOrderById(id) {
  const orderRow = await findOrderRowById(id);
  const order = mapOrder(orderRow);
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

  const row = await getPrisma().order.findFirst({
    where: {
      paymentGateway: normalizedGateway,
      gatewayPaymentId: normalizedGatewayPaymentId,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const orderId = normalizeText(row?.id);
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

  const row = await getPrisma().order.findFirst({
    where: {
      paymentGateway: normalizedGateway,
      gatewayOrderId: normalizedGatewayOrderId,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const orderId = normalizeText(row?.id);
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

  const rows = await getPrisma().order.findMany({
    where: { customerRef: normalizedCustomerRef },
    orderBy: { placedAt: "desc" },
    take: 25,
  });

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

  const where = {};
  if (normalizedStatus) {
    where.status = normalizedStatus;
  }
  if (normalizedPaymentStatus) {
    where.paymentStatus = normalizedPaymentStatus;
  }

  const [total, rows] = await Promise.all([
    getPrisma().order.count({ where }),
    getPrisma().order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);

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

  const data = {};
  if (normalizedStatus) data.status = normalizedStatus;
  if (normalizedPaymentStatus) data.paymentStatus = normalizedPaymentStatus;
  if (normalizedPaymentGateway) data.paymentGateway = normalizedPaymentGateway;
  if (normalizedGatewayOrderId) data.gatewayOrderId = normalizedGatewayOrderId;
  if (normalizedGatewayPaymentId) data.gatewayPaymentId = normalizedGatewayPaymentId;
  if (normalizedGatewaySignature) data.gatewaySignature = normalizedGatewaySignature;
  if (normalizedFulfillmentProvider) data.fulfillmentProvider = normalizedFulfillmentProvider;
  if (normalizedFulfillmentOrderId) data.fulfillmentOrderId = normalizedFulfillmentOrderId;
  if (normalizedFulfillmentShipmentId) data.fulfillmentShipmentId = normalizedFulfillmentShipmentId;
  if (normalizedFulfillmentAwbCode) data.fulfillmentAwbCode = normalizedFulfillmentAwbCode;
  if (normalizedFulfillmentCourierName) data.fulfillmentCourierName = normalizedFulfillmentCourierName;
  if (normalizedFulfillmentStatus) data.fulfillmentStatus = normalizedFulfillmentStatus;
  if (Object.prototype.hasOwnProperty.call(input, "fulfillmentSyncedAt")) {
    data.fulfillmentSyncedAt = input.fulfillmentSyncedAt || null;
  }
  if (fulfillmentPayloadJson !== undefined) {
    data.fulfillmentPayloadJson = fulfillmentPayloadJson;
  }

  if (Object.keys(data).length === 0) {
    return findOrderById(normalizedOrderId);
  }

  const now = new Date();
  data.updatedAt = now;

  try {
    await getPrisma().order.update({
      where: { id: normalizedOrderId },
      data,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return null;
    }
    throw error;
  }

  return findOrderById(normalizedOrderId);
}

export async function insertOrderRow(entry, prismaClient = getPrisma()) {
  await prismaClient.order.create({
    data: {
      id: entry.orderId,
      cartId: entry.cartId,
      customerRef: entry.customerRef,
      customerName: entry.customerName,
      customerEmail: entry.customerEmail,
      customerPhone: entry.customerPhone,
      shippingAddressJson: entry.shippingAddressJson,
      paymentMethod: entry.paymentMethod,
      paymentStatus: entry.paymentStatus,
      paymentGateway: entry.paymentGateway,
      gatewayOrderId: entry.gatewayOrderId,
      gatewayPaymentId: entry.gatewayPaymentId,
      gatewaySignature: entry.gatewaySignature,
      fulfillmentProvider: entry.fulfillmentProvider || "",
      fulfillmentOrderId: entry.fulfillmentOrderId || "",
      fulfillmentShipmentId: entry.fulfillmentShipmentId || "",
      fulfillmentAwbCode: entry.fulfillmentAwbCode || "",
      fulfillmentCourierName: entry.fulfillmentCourierName || "",
      fulfillmentStatus: entry.fulfillmentStatus || "",
      fulfillmentSyncedAt: entry.fulfillmentSyncedAt || null,
      fulfillmentPayloadJson: entry.fulfillmentPayloadJson || null,
      currency: entry.currency,
      status: entry.status,
      subtotal: entry.subtotal,
      shippingFee: entry.shippingFee,
      total: entry.total,
      placedAt: entry.now,
      createdAt: entry.now,
      updatedAt: entry.now,
    },
  });
}

export async function insertOrderItemRow(items, now, prismaClient = getPrisma()) {
  const itemsArray = Array.isArray(items) ? items : [items];
  if (itemsArray.length === 0) return;
  await prismaClient.orderItem.createMany({
    data: itemsArray.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      createdAt: now,
      updatedAt: now,
    })),
  });
}

export async function insertOrderComboItemRow(items, now, prismaClient = getPrisma()) {
  const itemsArray = Array.isArray(items) ? items : [items];
  if (itemsArray.length === 0) return;
  await prismaClient.orderComboItem.createMany({
    data: itemsArray.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      comboOfferId: item.comboOfferId,
      comboTitle: item.comboTitle,
      comboDescription: item.comboDescription || "",
      bannerImageUrl: item.bannerImageUrl,
      productsJson: item.productsJson,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      createdAt: now,
      updatedAt: now,
    })),
  });
}

export async function decrementProductStock(productId, quantity, now, prismaClient = getPrisma()) {
  await prismaClient.product.update({
    where: { id: productId },
    data: {
      stock: { decrement: quantity },
      updatedAt: now,
    },
  });
}

export async function findProductForCheckout(productId, prismaClient = getPrisma()) {
  const row = await prismaClient.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, price: true, stock: true, isActive: true },
  });

  return row ?? null;
}

export async function findProductsForCheckout(productIds, prismaClient = getPrisma()) {
  if (!productIds || productIds.length === 0) {
    return [];
  }
  return prismaClient.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, price: true, stock: true, isActive: true },
  });
}
