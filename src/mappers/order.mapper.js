import { toIsoString } from "../utils/dates.js";

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function extractTrackingDetails(payload) {
  if (!payload || typeof payload !== "object") {
    return {
      currentStatus: "",
      currentLocation: "",
      expectedDeliveryDate: "",
      deliveredDate: "",
      activities: [],
    };
  }

  const trackingData = payload.tracking_data || payload.data || payload;
  const shipmentTrack = Array.isArray(trackingData?.shipment_track) ? trackingData.shipment_track[0] : null;
  const rawActivities = Array.isArray(trackingData?.shipment_track_activities)
    ? trackingData.shipment_track_activities
    : [];
  const activities = rawActivities.slice(0, 8).map((activity) => ({
    date: cleanText(activity?.date),
    status: cleanText(activity?.activity || activity?.status),
    location: cleanText(activity?.location),
  }));
  const latestActivity = activities[0] || null;

  return {
    currentStatus: cleanText(
      shipmentTrack?.current_status ||
        latestActivity?.status ||
        trackingData?.status ||
        trackingData?.error,
    ),
    currentLocation: cleanText(shipmentTrack?.current_location || latestActivity?.location),
    expectedDeliveryDate: cleanText(shipmentTrack?.edd || shipmentTrack?.expected_delivery_date),
    deliveredDate: cleanText(shipmentTrack?.delivered_date),
    activities,
  };
}

export function mapOrder(row) {
  if (!row) {
    return null;
  }

  let shippingAddress = null;
  if (typeof row.shippingAddressJson === "string" && row.shippingAddressJson.trim()) {
    try {
      shippingAddress = JSON.parse(row.shippingAddressJson);
    } catch {
      shippingAddress = null;
    }
  }

  let fulfillmentPayload = null;
  if (typeof row.fulfillmentPayloadJson === "string" && row.fulfillmentPayloadJson.trim()) {
    try {
      fulfillmentPayload = JSON.parse(row.fulfillmentPayloadJson);
    } catch {
      fulfillmentPayload = null;
    }
  }

  return {
    id: row.id,
    cartId: row.cartId ?? null,
    customerRef: row.customerRef,
    customerName: row.customerName ?? "",
    customerEmail: row.customerEmail ?? "",
    customerPhone: row.customerPhone ?? "",
    shippingAddress: shippingAddress ?? {},
    paymentMethod: row.paymentMethod ?? "cod",
    paymentStatus: row.paymentStatus ?? "pending",
    paymentGateway: row.paymentGateway ?? "",
    gatewayOrderId: row.gatewayOrderId ?? "",
    gatewayPaymentId: row.gatewayPaymentId ?? "",
    gatewaySignature: row.gatewaySignature ?? "",
    fulfillment: {
      provider: row.fulfillmentProvider ?? "",
      orderId: row.fulfillmentOrderId ?? "",
      shipmentId: row.fulfillmentShipmentId ?? "",
      awbCode: row.fulfillmentAwbCode ?? "",
      courierName: row.fulfillmentCourierName ?? "",
      status: row.fulfillmentStatus ?? "",
      syncedAt: toIsoString(row.fulfillmentSyncedAt),
      tracking: extractTrackingDetails(fulfillmentPayload),
      payload: fulfillmentPayload,
    },
    currency: row.currency ?? "INR",
    status: row.status ?? "placed",
    subtotal: Number(row.subtotal ?? 0),
    shippingFee: Number(row.shippingFee ?? 0),
    total: Number(row.total ?? 0),
    placedAt: toIsoString(row.placedAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}
