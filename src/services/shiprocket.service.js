import {
  SHIPROCKET_API_BASE_URL,
  SHIPROCKET_DEFAULT_CHANNEL_ID,
  SHIPROCKET_DEFAULT_PACKAGE_BREADTH_CM,
  SHIPROCKET_DEFAULT_PACKAGE_HEIGHT_CM,
  SHIPROCKET_DEFAULT_PACKAGE_LENGTH_CM,
  SHIPROCKET_DEFAULT_PACKAGE_WEIGHT_KG,
  SHIPROCKET_DEFAULT_PICKUP_LOCATION,
} from "../config/environment.js";
import { createHttpError } from "../errors/index.js";
import { findOrderById, updateOrderById } from "../repositories/orders.repository.js";
import { cleanText } from "../utils.js";

let cachedToken = "";
let cachedTokenExpiresAt = 0;

export function isShiprocketConfigured() {
  return Boolean(cleanText(process.env.SHIPROCKET_EMAIL) && cleanText(process.env.SHIPROCKET_PASSWORD));
}

function getShiprocketCredentials() {
  const email = cleanText(process.env.SHIPROCKET_EMAIL);
  const password = cleanText(process.env.SHIPROCKET_PASSWORD);

  if (!email || !password) {
    throw createHttpError(503, "Shiprocket is not configured on the server.");
  }

  return { email, password };
}

async function readJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorDetails = cleanText(
      payload?.errors && typeof payload.errors === "object" ? JSON.stringify(payload.errors) : payload?.errors,
    );
    const message = [
      cleanText(payload?.message) || cleanText(payload?.error) || "Shiprocket API request failed.",
      errorDetails,
    ]
      .filter(Boolean)
      .join(" ");
    throw createHttpError(response.status >= 400 && response.status < 600 ? response.status : 502, message);
  }

  return payload;
}

function createShiprocketValidationError(message) {
  return createHttpError(400, message);
}

function normalizePincode(value) {
  return cleanText(value).replace(/\D/g, "");
}

function normalizeShiprocketCountry(value) {
  const normalized = cleanText(value).toLowerCase();
  if (!normalized || normalized === "in" || normalized === "india") {
    return "India";
  }
  return cleanText(value);
}

function validatePositivePackageNumber(value, fieldName) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw createShiprocketValidationError(`Shiprocket ${fieldName} must be greater than 0.`);
  }

  return numberValue;
}

function validateShiprocketPayload(payload) {
  const phone = cleanText(payload.billing_phone).replace(/\D/g, "");
  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw createShiprocketValidationError("Shiprocket billing phone must be a valid 10-digit Indian mobile number.");
  }

  if (!/^\d{6}$/.test(cleanText(payload.billing_pincode))) {
    throw createShiprocketValidationError("Shiprocket billing pincode must be a valid 6-digit Indian pincode.");
  }

  if (!cleanText(payload.billing_email).includes("@")) {
    throw createShiprocketValidationError("Shiprocket billing email must be valid.");
  }

  if (Number(payload.sub_total) <= 0) {
    throw createShiprocketValidationError("Shiprocket order subtotal must be greater than 0.");
  }

  if (!Array.isArray(payload.order_items) || payload.order_items.length === 0) {
    throw createShiprocketValidationError("Shiprocket order must include at least one item.");
  }

  for (const item of payload.order_items) {
    if (!cleanText(item.name) || !cleanText(item.sku)) {
      throw createShiprocketValidationError("Every Shiprocket item must include name and sku.");
    }
    if (Number(item.units) <= 0 || Number(item.selling_price) < 0) {
      throw createShiprocketValidationError("Every Shiprocket item must include valid units and selling price.");
    }
  }
}

function summarizeShiprocketPayload(payload) {
  return {
    order_id: payload.order_id,
    pickup_location: payload.pickup_location,
    billing_city: payload.billing_city,
    billing_pincode: payload.billing_pincode,
    billing_state: payload.billing_state,
    billing_phone: payload.billing_phone,
    payment_method: payload.payment_method,
    sub_total: payload.sub_total,
    dimensions: {
      length: payload.length,
      breadth: payload.breadth,
      height: payload.height,
      weight: payload.weight,
    },
    item_count: payload.order_items?.length ?? 0,
  };
}

export async function getShiprocketToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedToken && cachedTokenExpiresAt > Date.now() + 60_000) {
    return cachedToken;
  }

  const credentials = getShiprocketCredentials();
  const response = await fetch(`${SHIPROCKET_API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  const payload = await readJsonResponse(response);
  const token = cleanText(payload?.token);
  if (!token) {
    throw createHttpError(502, "Shiprocket did not return an authentication token.");
  }

  cachedToken = token;
  cachedTokenExpiresAt = Date.now() + 9 * 24 * 60 * 60 * 1000;
  return token;
}

export async function shiprocketRequest(path, options = {}) {
  const token = await getShiprocketToken();
  const response = await fetch(`${SHIPROCKET_API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    const refreshedToken = await getShiprocketToken({ forceRefresh: true });
    const retryResponse = await fetch(`${SHIPROCKET_API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshedToken}`,
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    return readJsonResponse(retryResponse);
  }

  return readJsonResponse(response);
}

function formatShiprocketOrderDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return formatShiprocketOrderDate(new Date());
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}

function splitCustomerName(fullName) {
  const parts = cleanText(fullName).split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0] || "Customer", lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) || "",
  };
}

function normalizePhone(phone) {
  const digits = cleanText(phone).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  return digits;
}

function buildBillingAddress(order) {
  const address = order.shippingAddress || {};
  const line1 = cleanText(address.line1 || address.addressLine1 || address.address || address.street);
  const line2 = cleanText(address.line2 || address.addressLine2 || address.landmark);
  const city = cleanText(address.city);
  const state = cleanText(address.state);
  const pincode = normalizePincode(address.postalCode || address.pincode || address.zip);
  const country = normalizeShiprocketCountry(address.country || "India");

  if (!line1 || !city || !state || !pincode) {
    throw createHttpError(400, "Order shipping address must include line1, city, state, and postalCode for Shiprocket.");
  }

  return { line1, line2, city, state, pincode, country };
}

function buildShiprocketItems(order) {
  const productItems = (order.items || []).map((item) => ({
    name: cleanText(item.productName) || "Product",
    sku: cleanText(item.productId || item.id).slice(0, 64) || "SKU",
    units: Math.max(1, Number(item.quantity) || 1),
    selling_price: Number(item.unitPrice || item.lineTotal || 0),
  }));

  const comboItems = (order.comboItems || []).map((item) => ({
    name: cleanText(item.comboTitle) || "Combo Offer",
    sku: cleanText(item.comboOfferId || item.id).slice(0, 64) || "COMBO",
    units: Math.max(1, Number(item.quantity) || 1),
    selling_price: Number(item.unitPrice || item.lineTotal || 0),
  }));

  const items = [...productItems, ...comboItems].filter((item) => item.selling_price >= 0);
  if (items.length === 0) {
    throw createHttpError(400, "Order must include at least one item for Shiprocket.");
  }

  return items;
}

export function buildShiprocketOrderPayload(order, input = {}) {
  const pickupLocation = cleanText(input.pickupLocation || SHIPROCKET_DEFAULT_PICKUP_LOCATION);
  if (!pickupLocation) {
    throw createHttpError(503, "Shiprocket pickup location is not configured.");
  }

  const billing = buildBillingAddress(order);
  const { firstName, lastName } = splitCustomerName(order.customerName);
  const paymentMethod = cleanText(order.paymentMethod).toLowerCase() === "cod" ? "COD" : "Prepaid";
  const payload = {
    order_id: cleanText(input.externalOrderId) || order.id,
    order_date: formatShiprocketOrderDate(order.placedAt || order.createdAt),
    pickup_location: pickupLocation,
    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: billing.line1,
    billing_address_2: billing.line2,
    billing_city: billing.city,
    billing_pincode: billing.pincode,
    billing_state: billing.state,
    billing_country: billing.country,
    billing_email: cleanText(order.customerEmail),
    billing_phone: normalizePhone(order.customerPhone),
    shipping_is_billing: true,
    order_items: buildShiprocketItems(order),
    payment_method: paymentMethod,
    sub_total: Number(order.subtotal || order.total || 0),
    length: validatePositivePackageNumber(input.length || SHIPROCKET_DEFAULT_PACKAGE_LENGTH_CM, "length"),
    breadth: validatePositivePackageNumber(input.breadth || SHIPROCKET_DEFAULT_PACKAGE_BREADTH_CM, "breadth"),
    height: validatePositivePackageNumber(input.height || SHIPROCKET_DEFAULT_PACKAGE_HEIGHT_CM, "height"),
    weight: validatePositivePackageNumber(input.weight || SHIPROCKET_DEFAULT_PACKAGE_WEIGHT_KG, "weight"),
  };

  const channelId = cleanText(input.channelId || SHIPROCKET_DEFAULT_CHANNEL_ID);
  if (channelId) {
    payload.channel_id = channelId;
  }

  validateShiprocketPayload(payload);
  return payload;
}

function extractShiprocketFulfillment(responsePayload) {
  return {
    provider: "shiprocket",
    orderId: cleanText(responsePayload?.order_id || responsePayload?.data?.order_id),
    shipmentId: cleanText(responsePayload?.shipment_id || responsePayload?.data?.shipment_id),
    awbCode: cleanText(responsePayload?.awb_code || responsePayload?.data?.awb_code),
    courierName: cleanText(responsePayload?.courier_name || responsePayload?.data?.courier_name),
    status: cleanText(responsePayload?.status || responsePayload?.data?.status || "created").toLowerCase(),
    payloadJson: JSON.stringify(responsePayload),
  };
}

function extractAwbFulfillment(responsePayload) {
  const response = responsePayload?.response || responsePayload?.data || responsePayload || {};
  return {
    awbCode: cleanText(response?.awb_code || response?.awb || responsePayload?.awb_code),
    courierName: cleanText(response?.courier_name || response?.courier_company_id || responsePayload?.courier_name),
    status: cleanText(response?.status || responsePayload?.status || "awb_assigned").toLowerCase(),
    payloadJson: JSON.stringify(responsePayload),
  };
}

function extractTrackingStatus(responsePayload) {
  const trackingData = responsePayload?.tracking_data || responsePayload?.data || responsePayload || {};
  const shipmentTrack = Array.isArray(trackingData?.shipment_track) ? trackingData.shipment_track[0] : null;
  const activities = Array.isArray(trackingData?.shipment_track_activities)
    ? trackingData.shipment_track_activities
    : [];
  const latestActivity = activities[0] || null;

  return cleanText(
    shipmentTrack?.current_status ||
      shipmentTrack?.delivered_to ||
      latestActivity?.activity ||
      trackingData?.error ||
      trackingData?.status ||
      "tracking_refreshed",
  ).toLowerCase();
}

function mapShiprocketStatusToOrderStatus(status) {
  const normalizedStatus = cleanText(status).toLowerCase();
  if (!normalizedStatus) {
    return "";
  }

  if (normalizedStatus.includes("delivered")) {
    return "delivered";
  }
  if (
    normalizedStatus.includes("out for delivery") ||
    normalizedStatus.includes("in transit") ||
    normalizedStatus.includes("shipped") ||
    normalizedStatus.includes("reached") ||
    normalizedStatus.includes("manifested")
  ) {
    return "shipped";
  }
  if (
    normalizedStatus.includes("pickup") ||
    normalizedStatus.includes("awb") ||
    normalizedStatus.includes("packed") ||
    normalizedStatus.includes("ready")
  ) {
    return "packed";
  }
  if (
    normalizedStatus.includes("cancel") ||
    normalizedStatus.includes("rto") ||
    normalizedStatus.includes("return") ||
    normalizedStatus.includes("lost") ||
    normalizedStatus.includes("damaged")
  ) {
    return "cancelled";
  }

  return "";
}

export async function createShiprocketOrderForOrder(orderId, input = {}) {
  const order = await findOrderById(orderId);
  if (!order) {
    throw createHttpError(404, "Order not found.");
  }

  if (order.fulfillment?.provider === "shiprocket" && order.fulfillment?.orderId && !input.force) {
    return order;
  }

  const requestPayload = buildShiprocketOrderPayload(order, input);
  let responsePayload;
  try {
    responsePayload = await shiprocketRequest("/orders/create/adhoc", {
      method: "POST",
      body: requestPayload,
    });
  } catch (error) {
    console.error("Shiprocket order create failed:", {
      message: error?.message || String(error),
      payload: summarizeShiprocketPayload(requestPayload),
    });
    throw error;
  }
  const fulfillment = extractShiprocketFulfillment(responsePayload);

  const updatedOrder = await updateOrderById(order.id, {
    status: "synced",
    fulfillmentProvider: fulfillment.provider,
    fulfillmentOrderId: fulfillment.orderId,
    fulfillmentShipmentId: fulfillment.shipmentId,
    fulfillmentAwbCode: fulfillment.awbCode,
    fulfillmentCourierName: fulfillment.courierName,
    fulfillmentStatus: fulfillment.status,
    fulfillmentSyncedAt: new Date(),
    fulfillmentPayloadJson: fulfillment.payloadJson,
  });

  return updatedOrder || order;
}

export async function assignShiprocketAwbForOrder(orderId, input = {}) {
  const order = await findOrderById(orderId);
  if (!order) {
    throw createHttpError(404, "Order not found.");
  }

  const shipmentId = cleanText(order.fulfillment?.shipmentId || input.shipmentId);
  if (!shipmentId) {
    throw createHttpError(400, "Shiprocket shipment id is required before assigning AWB.");
  }

  if (order.fulfillment?.awbCode && !input.force) {
    return order;
  }

  const requestPayload = {
    shipment_id: shipmentId,
  };
  const courierId = cleanText(input.courierId);
  if (courierId) {
    requestPayload.courier_id = courierId;
  }
  if (input.reassign === true) {
    requestPayload.status = "reassign";
  }

  const responsePayload = await shiprocketRequest("/courier/assign/awb", {
    method: "POST",
    body: requestPayload,
  });
  const fulfillment = extractAwbFulfillment(responsePayload);

  const updatedOrder = await updateOrderById(order.id, {
    fulfillmentProvider: "shiprocket",
    fulfillmentShipmentId: shipmentId,
    fulfillmentAwbCode: fulfillment.awbCode,
    fulfillmentCourierName: fulfillment.courierName,
    fulfillmentStatus: fulfillment.status,
    fulfillmentSyncedAt: new Date(),
    fulfillmentPayloadJson: fulfillment.payloadJson,
  });

  return updatedOrder || order;
}

export async function refreshShiprocketTrackingForOrder(orderId, input = {}) {
  const order = await findOrderById(orderId);
  if (!order) {
    throw createHttpError(404, "Order not found.");
  }

  const awbCode = cleanText(order.fulfillment?.awbCode || input.awbCode);
  if (!awbCode) {
    throw createHttpError(400, "Shiprocket AWB code is required before refreshing tracking.");
  }

  const responsePayload = await shiprocketRequest(`/courier/track/awb/${encodeURIComponent(awbCode)}`);
  const status = extractTrackingStatus(responsePayload);
  const mappedOrderStatus = mapShiprocketStatusToOrderStatus(status);

  const updatedOrder = await updateOrderById(order.id, {
    status: mappedOrderStatus,
    fulfillmentProvider: "shiprocket",
    fulfillmentAwbCode: awbCode,
    fulfillmentStatus: status,
    fulfillmentSyncedAt: new Date(),
    fulfillmentPayloadJson: JSON.stringify(responsePayload),
  });

  return updatedOrder || order;
}
