import { toIsoString } from "../utils/dates.js";

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
