import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

const WEBHOOK_IDEMPOTENCY_TTL_SEC = Math.max(
  300,
  Number(process.env.RAZORPAY_WEBHOOK_IDEMPOTENCY_TTL_SEC) || 24 * 60 * 60,
);
const RECONCILE_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.RAZORPAY_RECONCILE_INTERVAL_MS) || 5 * 60 * 1000,
);
const RECONCILE_LIMIT = Math.max(1, Math.min(Number(process.env.RAZORPAY_RECONCILE_LIMIT) || 200, 500));
const processedWebhookMemory = new Map();

let reconcileTimer = null;
let reconcileInFlight = false;
let paymentsRuntimeInitialized = false;

function pruneProcessedWebhookMemory(nowMs = Date.now()) {
  for (const [eventId, expiresAt] of processedWebhookMemory.entries()) {
    if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
      processedWebhookMemory.delete(eventId);
    }
  }
}

function buildRazorpayReceipt() {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const receipt = `rcpt_${Date.now().toString(36)}_${randomPart}`;
  return receipt.slice(0, 40);
}

function deriveWebhookEventId(payload, headerEventId) {
  const headerId = cleanText(headerEventId);
  if (headerId) {
    return headerId;
  }

  const eventName = cleanText(payload?.event).toLowerCase();
  const paymentId = cleanText(payload?.payload?.payment?.entity?.id);
  const orderId =
    cleanText(payload?.payload?.payment?.entity?.order_id) || cleanText(payload?.payload?.order?.entity?.id);
  const createdAt = cleanText(payload?.created_at);
  return [eventName, paymentId || orderId, createdAt].filter(Boolean).join(":");
}

async function registerWebhookEventIfFirst(eventId) {
  const normalizedEventId = cleanText(eventId);
  if (!normalizedEventId) {
    return true;
  }

  const nowMs = Date.now();
  pruneProcessedWebhookMemory(nowMs);

  const memoryExpiresAt = Number(processedWebhookMemory.get(normalizedEventId) ?? 0);
  if (memoryExpiresAt > nowMs) {
    return false;
  }

  const redisKey = `payments:razorpay:webhook:${normalizedEventId}`;
  const existing = await getCacheJson(redisKey);
  if (existing?.processedAt) {
    processedWebhookMemory.set(normalizedEventId, nowMs + WEBHOOK_IDEMPOTENCY_TTL_SEC * 1000);
    return false;
  }

  await setCacheJson(
    redisKey,
    {
      processedAt: new Date(nowMs).toISOString(),
    },
    WEBHOOK_IDEMPOTENCY_TTL_SEC,
  );

  processedWebhookMemory.set(normalizedEventId, nowMs + WEBHOOK_IDEMPOTENCY_TTL_SEC * 1000);
  return true;
}

function mapRazorpayPaymentUpdate(paymentStatus) {
  const normalizedStatus = cleanText(paymentStatus).toLowerCase();
  if (normalizedStatus === "captured") {
    return { paymentStatus: "paid", status: "purchased" };
  }

  if (normalizedStatus === "authorized") {
    return { paymentStatus: "authorized", status: "" };
  }

  if (normalizedStatus === "failed") {
    return { paymentStatus: "failed", status: "failed" };
  }

  if (normalizedStatus === "refunded") {
    return { paymentStatus: "refunded", status: "" };
  }

  if (normalizedStatus === "partially_refunded" || normalizedStatus === "partial_refund") {
    return { paymentStatus: "partial_refund", status: "" };
  }

  return null;
}

function deriveNextOrderStatus(currentStatus, targetStatus) {
  const normalizedCurrentStatus = cleanText(currentStatus).toLowerCase();
  const normalizedTargetStatus = cleanText(targetStatus).toLowerCase();

  if (!normalizedTargetStatus) {
    return "";
  }

  if (normalizedTargetStatus === "purchased") {
    if (["placed", "failed", "purchased"].includes(normalizedCurrentStatus)) {
      return "purchased";
    }

    return "";
  }

  if (normalizedTargetStatus === "failed") {
    if (["placed", "purchased", "failed"].includes(normalizedCurrentStatus)) {
      return "failed";
    }

    return "";
  }

  return "";
}

async function findOrderForPaymentEntity(paymentEntity) {
  const gatewayPaymentId = cleanText(paymentEntity?.id);
  const gatewayOrderId = cleanText(paymentEntity?.order_id);

  if (gatewayPaymentId) {
    const orderByPaymentId = await findOrderByGatewayPaymentId(gatewayPaymentId, "razorpay");
    if (orderByPaymentId) {
      return orderByPaymentId;
    }
  }

  if (gatewayOrderId) {
    const orderByOrderId = await findOrderByGatewayOrderId(gatewayOrderId, "razorpay");
    if (orderByOrderId) {
      return orderByOrderId;
    }
  }

  return null;
}

async function syncOrderFromPaymentEntity(order, paymentEntity) {
  if (!order || !paymentEntity || typeof paymentEntity !== "object") {
    return { updated: false, order: null };
  }

  const gatewayPaymentId = cleanText(paymentEntity?.id);
  const gatewayOrderId = cleanText(paymentEntity?.order_id);
  const paymentUpdate = mapRazorpayPaymentUpdate(paymentEntity?.status);

  const patch = {};
  if (gatewayPaymentId && gatewayPaymentId !== cleanText(order.gatewayPaymentId)) {
    patch.gatewayPaymentId = gatewayPaymentId;
  }
  if (gatewayOrderId && gatewayOrderId !== cleanText(order.gatewayOrderId)) {
    patch.gatewayOrderId = gatewayOrderId;
  }

  if (paymentUpdate?.paymentStatus && paymentUpdate.paymentStatus !== cleanText(order.paymentStatus).toLowerCase()) {
    patch.paymentStatus = paymentUpdate.paymentStatus;
  }

  const nextStatus = deriveNextOrderStatus(order.status, paymentUpdate?.status);
  if (nextStatus && nextStatus !== cleanText(order.status).toLowerCase()) {
    patch.status = nextStatus;
  }

  if (Object.keys(patch).length === 0) {
    return { updated: false, order };
  }

  const updatedOrder = await updateOrderById(order.id, patch);
  return {
    updated: Boolean(updatedOrder),
    order: updatedOrder ?? order,
  };
}

async function runRazorpayReconciliation(source = "interval") {
  if (reconcileInFlight) {
    return {
      source,
      skipped: true,
      reason: "already_running",
      processed: 0,
      updated: 0,
      failed: 0,
    };
  }

  if (!isRazorpayConfigured()) {
    return {
      source,
      skipped: true,
      reason: "razorpay_not_configured",
      processed: 0,
      updated: 0,
      failed: 0,
    };
  }

  reconcileInFlight = true;
  try {
    const [pendingOrdersPayload, authorizedOrdersPayload] = await Promise.all([
      getOrdersForAdmin({ paymentStatus: "pending", limit: RECONCILE_LIMIT, offset: 0 }),
      getOrdersForAdmin({ paymentStatus: "authorized", limit: RECONCILE_LIMIT, offset: 0 }),
    ]);

    const orderMap = new Map();
    for (const order of [...(pendingOrdersPayload?.orders ?? []), ...(authorizedOrdersPayload?.orders ?? [])]) {
      if (cleanText(order?.paymentGateway).toLowerCase() !== "razorpay") {
        continue;
      }

      const gatewayPaymentId = cleanText(order?.gatewayPaymentId);
      if (!gatewayPaymentId) {
        continue;
      }

      orderMap.set(order.id, order);
    }

    const candidates = Array.from(orderMap.values());
    let processed = 0;
    let updated = 0;
    let failed = 0;

    for (const order of candidates) {
      processed += 1;
      try {
        const gatewayPaymentId = cleanText(order.gatewayPaymentId);
        const paymentEntity = await razorpayRequest(`/payments/${encodeURIComponent(gatewayPaymentId)}`);
        const syncResult = await syncOrderFromPaymentEntity(order, paymentEntity);
        if (syncResult.updated) {
          updated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      source,
      skipped: false,
      processed,
      updated,
      failed,
    };
  } finally {
    reconcileInFlight = false;
  }
}

function startRazorpayReconciliationLoop() {
  if (reconcileTimer) {
    return;
  }

  reconcileTimer = setInterval(() => {
    void runRazorpayReconciliation("interval").catch((error) => {
      console.error("Razorpay reconciliation tick failed:", error?.message || error);
    });
  }, RECONCILE_INTERVAL_MS);

  if (typeof reconcileTimer.unref === "function") {
    reconcileTimer.unref();
  }

  void runRazorpayReconciliation("startup").catch((error) => {
    console.error("Razorpay reconciliation startup failed:", error?.message || error);
  });
}

export function initPaymentsRuntime() {
  if (paymentsRuntimeInitialized) {
    return;
  }

  paymentsRuntimeInitialized = true;
  startRazorpayReconciliationLoop();
}

app.post("/api/payments/razorpay/order", async (req, res, next) => {
  try {
    const authSession = await requireAuthenticatedSession(req, res);
    if (!authSession) {
      return;
    }

    if (!isRazorpayConfigured()) {
      return res.status(503).json({ message: "Razorpay is not configured on the server." });
    }

    const customerRef = authSession.user.id;

    const cart = await getCartByCustomerRef(customerRef);
    if (!cart || (cart.items.length === 0 && (cart.comboItems?.length ?? 0) === 0)) {
      return res.status(409).json({ message: "Cart is empty." });
    }

    const amountPaise = Math.round(Number(cart.subtotal || 0) * 100);
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
      return res.status(409).json({ message: "Cart total must be greater than zero." });
    }

    const razorpayOrder = await razorpayRequest("/orders", {
      method: "POST",
      body: {
        amount: amountPaise,
        currency: "INR",
        receipt: buildRazorpayReceipt(),
        notes: {
          customerRef,
          userId: authSession.user.id,
        },
      },
    });

    return res.status(201).json({
      keyId: cleanText(process.env.RAZORPAY_KEY_ID),
      customerRef,
      orderId: cleanText(razorpayOrder?.id),
      amount: Number(razorpayOrder?.amount ?? amountPaise),
      currency: cleanText(razorpayOrder?.currency || "INR"),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/payments/razorpay/verify-and-checkout", async (req, res, next) => {
  try {
    const authSession = await requireAuthenticatedSession(req, res);
    if (!authSession) {
      return;
    }

    if (!isRazorpayConfigured()) {
      return res.status(503).json({ message: "Razorpay is not configured on the server." });
    }

    const customerRef = authSession.user.id;

    const customerName = cleanText(req.body?.customerName) || cleanText(authSession.user.fullName);
    const customerEmail = cleanText(req.body?.customerEmail) || cleanText(authSession.user.email);
    const customerPhone = cleanText(req.body?.customerPhone) || authSession.user.phone;
    const shippingAddress =
      req.body?.shippingAddress && typeof req.body.shippingAddress === "object" ? req.body.shippingAddress : {};
    const razorpayOrderId = cleanText(req.body?.razorpayOrderId);
    const razorpayPaymentId = cleanText(req.body?.razorpayPaymentId);
    const razorpaySignature = cleanText(req.body?.razorpaySignature);

    if (!customerName || !customerEmail) {
      return res.status(400).json({ message: "Customer name and email are required for checkout." });
    }

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: "Razorpay order id, payment id, and signature are required." });
    }

    const existingOrder = await findOrderByGatewayPaymentId(razorpayPaymentId, "razorpay");
    if (existingOrder) {
      if (existingOrder.customerRef !== customerRef) {
        return res.status(409).json({ message: "Payment is already linked to another order." });
      }

      return res.json({
        customerRef,
        order: existingOrder,
        alreadyProcessed: true,
      });
    }

    const { keySecret } = getRazorpayConfig();
    const isSignatureValid = verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
      keySecret,
    });
    if (!isSignatureValid) {
      return res.status(400).json({ message: "Invalid Razorpay signature." });
    }

    const cart = await getCartByCustomerRef(customerRef);
    if (!cart || (cart.items.length === 0 && (cart.comboItems?.length ?? 0) === 0)) {
      return res.status(409).json({ message: "Cart is empty." });
    }

    const expectedAmountPaise = Math.round(Number(cart.subtotal || 0) * 100);
    if (!Number.isInteger(expectedAmountPaise) || expectedAmountPaise <= 0) {
      return res.status(409).json({ message: "Cart total must be greater than zero." });
    }

    const payment = await razorpayRequest(`/payments/${encodeURIComponent(razorpayPaymentId)}`);
    const paymentOrderId = cleanText(payment?.order_id);
    const paymentStatus = cleanText(payment?.status).toLowerCase();
    const paymentCurrency = cleanText(payment?.currency).toUpperCase();
    const paymentAmount = Number(payment?.amount ?? 0);

    if (paymentOrderId !== razorpayOrderId) {
      return res.status(409).json({ message: "Payment order mismatch." });
    }

    if (!["authorized", "captured"].includes(paymentStatus)) {
      return res.status(409).json({ message: "Payment is not authorized/captured yet." });
    }

    if (paymentCurrency && paymentCurrency !== "INR") {
      return res.status(409).json({ message: "Payment currency mismatch." });
    }

    if (paymentAmount !== expectedAmountPaise) {
      return res.status(409).json({ message: "Payment amount mismatch with cart total." });
    }

    const order = await createOrderFromCart({
      customerRef,
      customerName,
      customerEmail,
      customerPhone,
      paymentMethod: "razorpay",
      paymentStatus: "paid",
      paymentGateway: "razorpay",
      gatewayOrderId: razorpayOrderId,
      gatewayPaymentId: razorpayPaymentId,
      gatewaySignature: razorpaySignature,
      status: "purchased",
      shippingAddress,
      currency: "INR",
      shippingFee: 0,
    });

    if (SHIPROCKET_AUTO_CREATE_ORDER) {
      try {
        const syncedOrder = await createShiprocketOrderForOrder(order.id);
        return res.status(201).json({ customerRef, order: syncedOrder });
      } catch (error) {
        console.warn("Shiprocket auto-create failed:", error?.message || error);
      }
    }

    return res.status(201).json({ customerRef, order });
  } catch (error) {
    next(error);
  }
});

app.post("/api/payments/razorpay/webhook", async (req, res, next) => {
  try {
    if (!isRazorpayWebhookConfigured()) {
      return res.status(503).json({ message: "Razorpay webhook is not configured on the server." });
    }

    const rawBody = typeof req.rawBody === "string" ? req.rawBody : "";
    const signature = cleanText(req.get("x-razorpay-signature"));
    if (!rawBody || !signature) {
      return res.status(400).json({ message: "Missing Razorpay webhook signature or payload." });
    }

    const webhookSecret = getRazorpayWebhookSecret();
    const isSignatureValid = verifyRazorpayWebhookSignature({
      payload: rawBody,
      signature,
      webhookSecret,
    });
    if (!isSignatureValid) {
      return res.status(400).json({ message: "Invalid Razorpay webhook signature." });
    }

    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const eventName = cleanText(payload?.event).toLowerCase();
    const eventId = deriveWebhookEventId(payload, req.get("x-razorpay-event-id"));
    const isFirstEvent = await registerWebhookEventIfFirst(eventId);
    if (!isFirstEvent) {
      return res.status(200).json({
        received: true,
        duplicate: true,
        event: eventName,
        eventId,
      });
    }

    const paymentEntity = payload?.payload?.payment?.entity;
    if (!paymentEntity || typeof paymentEntity !== "object") {
      return res.status(200).json({
        received: true,
        duplicate: false,
        event: eventName,
        eventId,
        ignored: true,
      });
    }

    const order = await findOrderForPaymentEntity(paymentEntity);
    if (!order) {
      return res.status(200).json({
        received: true,
        duplicate: false,
        event: eventName,
        eventId,
        ignored: true,
      });
    }

    const syncResult = await syncOrderFromPaymentEntity(order, paymentEntity);
    return res.status(200).json({
      received: true,
      duplicate: false,
      event: eventName,
      eventId,
      orderId: order.id,
      updated: syncResult.updated,
    });
  } catch (error) {
    next(error);
  }
});

app.post(
  ["/api/admin/payments/razorpay/reconcile", "/admin/payments/razorpay/reconcile"],
  requireAdminAccess,
  async (_req, res, next) => {
    try {
      const summary = await runRazorpayReconciliation("admin");
      return res.json(summary);
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  ["/api/admin/payments/razorpay/verify/:orderId", "/admin/payments/razorpay/verify/:orderId"],
  requireAdminAccess,
  async (req, res, next) => {
    try {
      const orderId = cleanText(req.params.orderId);
      if (!orderId) {
        return res.status(400).json({ message: "Order id is required." });
      }

      const order = await findOrderById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found." });
      }

      if (cleanText(order.paymentGateway).toLowerCase() !== "razorpay") {
        return res.status(400).json({ message: "Order is not a Razorpay order." });
      }

      const gatewayPaymentId = cleanText(order.gatewayPaymentId);
      const gatewayOrderId = cleanText(order.gatewayOrderId);

      if (!gatewayPaymentId && !gatewayOrderId) {
        return res.status(400).json({ message: "Order does not have a Razorpay payment or order ID." });
      }

      let paymentEntity = null;
      if (gatewayPaymentId) {
        try {
          paymentEntity = await razorpayRequest(`/payments/${encodeURIComponent(gatewayPaymentId)}`);
        } catch (error) {
          console.warn("Failed to fetch Razorpay payment", error?.message);
        }
      }

      if (!paymentEntity && gatewayOrderId) {
        try {
          const payments = await razorpayRequest(`/orders/${encodeURIComponent(gatewayOrderId)}/payments`);
          if (payments?.items?.length > 0) {
            paymentEntity = payments.items[0];
          }
        } catch (error) {
           console.warn("Failed to fetch Razorpay payments for order", error?.message);
        }
      }

      if (!paymentEntity) {
        return res.status(404).json({ message: "Razorpay payment not found." });
      }

      const syncResult = await syncOrderFromPaymentEntity(order, paymentEntity);

      return res.json({
        orderId: order.id,
        localStatus: order.status,
        localPaymentStatus: order.paymentStatus,
        razorpay: {
          orderId: paymentEntity.order_id,
          paymentId: paymentEntity.id,
          status: paymentEntity.status,
          amount: paymentEntity.amount,
          currency: paymentEntity.currency,
          method: paymentEntity.method,
          email: paymentEntity.email,
          contact: paymentEntity.contact,
          createdAt: new Date((paymentEntity.created_at || 0) * 1000).toISOString(),
        },
        action: syncResult.updated ? "synced" : "already_in_sync",
        updatedOrder: syncResult.order,
      });

    } catch (error) {
      next(error);
    }
  },
);

app.get(
  ["/api/admin/payments/summary", "/admin/payments/summary"],
  requireAdminAccess,
  async (req, res, next) => {
    try {
      const summary = await getPaymentSummaryForAdmin();
      return res.json(summary);
    } catch (error) {
      next(error);
    }
  },
);

export default app;
