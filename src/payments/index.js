import { createHmac, timingSafeEqual } from "node:crypto";
import { RAZORPAY_API_BASE_URL } from "../config/environment.js";
import { createHttpError } from "../errors/index.js";
import { cleanText } from "../utils.js";

export function isRazorpayConfigured() {
  return Boolean(cleanText(process.env.RAZORPAY_KEY_ID) && cleanText(process.env.RAZORPAY_KEY_SECRET));
}

export function isRazorpayWebhookConfigured() {
  return Boolean(cleanText(process.env.RAZORPAY_WEBHOOK_SECRET));
}

export function getRazorpayConfig() {
  const keyId = cleanText(process.env.RAZORPAY_KEY_ID);
  const keySecret = cleanText(process.env.RAZORPAY_KEY_SECRET);

  if (!keyId || !keySecret) {
    throw createHttpError(503, "Razorpay is not configured on the server.");
  }

  return {
    keyId,
    keySecret,
  };
}

export function getRazorpayWebhookSecret() {
  const webhookSecret = cleanText(process.env.RAZORPAY_WEBHOOK_SECRET);
  if (!webhookSecret) {
    throw createHttpError(503, "Razorpay webhook is not configured on the server.");
  }

  return webhookSecret;
}

export async function razorpayRequest(path, options = {}) {
  const { keyId, keySecret } = getRazorpayConfig();
  const method = options.method || "GET";
  const requestHeaders = new Headers(options.headers || {});
  requestHeaders.set("Authorization", `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`);
  requestHeaders.set("Content-Type", "application/json");

  const response = await fetch(`${RAZORPAY_API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = cleanText(payload?.error?.description || payload?.message) || "Razorpay API request failed.";
    throw createHttpError(response.status >= 400 && response.status < 600 ? response.status : 502, message);
  }

  return payload;
}

export function verifyRazorpaySignature({ orderId, paymentId, signature, keySecret }) {
  const expectedSignature = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const providedBuffer = Buffer.from(signature, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function verifyRazorpayWebhookSignature({ payload, signature, webhookSecret }) {
  if (typeof payload !== "string" || !payload || !signature || !webhookSecret) {
    return false;
  }

  const expectedSignature = createHmac("sha256", webhookSecret).update(payload).digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const providedBuffer = Buffer.from(signature, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}
