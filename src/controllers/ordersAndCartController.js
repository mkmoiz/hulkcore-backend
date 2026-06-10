import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

const USER_CUSTOMER_REF_PREFIX = "usr_";

function isUserCustomerRef(customerRef) {
  return cleanText(customerRef).startsWith(USER_CUSTOMER_REF_PREFIX);
}

function respondWithCustomerRefError(res, error) {
  if (!error) {
    return false;
  }

  res.status(error.status).json({ message: error.message });
  return true;
}

async function resolveScopedCustomerRef(req, options = {}) {
  const authToken = extractAuthToken(req);
  let authSession = null;
  if (authToken) {
    authSession = await findAuthSessionByToken(authToken);
  }

  if (options.requireAuthenticated && !authSession?.user?.id) {
    return {
      error: {
        status: 401,
        message: options.authRequiredMessage || "Login required to continue.",
      },
    };
  }

  if (authSession?.user?.id) {
    return {
      customerRef: authSession.user.id,
      authSession,
    };
  }

  const customerRef = resolveCustomerRef(req);
  if (customerRef && !validateCustomerRef(customerRef)) {
    return {
      error: {
        status: 400,
        message: "Customer reference must be 3-128 characters using letters, numbers, underscore, or hyphen.",
      },
    };
  }

  if (customerRef && isUserCustomerRef(customerRef)) {
    return {
      error: {
        status: 401,
        message: "Login required to access user cart.",
      },
    };
  }

  if (!customerRef && options.allowGuest) {
    return {
      customerRef: createId("guest"),
      authSession: null,
    };
  }

  if (!customerRef && options.requireReference) {
    return {
      error: {
        status: 400,
        message: "Customer reference is required and must be 3-128 valid characters.",
      },
    };
  }

  return {
    customerRef,
    authSession: null,
  };
}

app.post("/api/cart/session", async (req, res, next) => {
  try {
    const resolved = await resolveScopedCustomerRef(req, { allowGuest: true });
    if (respondWithCustomerRefError(res, resolved.error)) {
      return;
    }
    const customerRef = resolved.customerRef;

    const cart = await getOrCreateActiveCart(customerRef);
    return res.status(201).json({ customerRef, cart });
  } catch (error) {
    next(error);
  }
});

app.get("/api/cart", async (req, res, next) => {
  try {
    const resolved = await resolveScopedCustomerRef(req, { allowGuest: true });
    if (respondWithCustomerRefError(res, resolved.error)) {
      return;
    }
    const customerRef = resolved.customerRef;

    const cart = await getCartByCustomerRef(customerRef);
    return res.json({ customerRef, cart });
  } catch (error) {
    next(error);
  }
});

app.post("/api/cart/items", async (req, res, next) => {
  try {
    const resolved = await resolveScopedCustomerRef(req, {
      requireAuthenticated: true,
      authRequiredMessage: "Login required before adding items to cart.",
      requireReference: true,
    });
    if (respondWithCustomerRefError(res, resolved.error)) {
      return;
    }
    const customerRef = resolved.customerRef;

    const productId = cleanText(req.body?.productId);
    if (!productId) {
      return res.status(400).json({ message: "Product is required." });
    }

    const quantity = toNonNegativeQuantity(req.body?.quantity, 1);
    if (quantity === null) {
      return res.status(400).json({ message: "Quantity must be a positive integer." });
    }

    const cart = await addItemToCart({
      customerRef,
      productId,
      quantity,
    });

    return res.status(201).json({ customerRef, cart });
  } catch (error) {
    next(error);
  }
});

app.post("/api/cart/combo-items", async (req, res, next) => {
  try {
    const resolved = await resolveScopedCustomerRef(req, {
      requireAuthenticated: true,
      authRequiredMessage: "Login required before adding combo offers to cart.",
      requireReference: true,
    });
    if (respondWithCustomerRefError(res, resolved.error)) {
      return;
    }
    const customerRef = resolved.customerRef;

    const comboOfferId = cleanText(req.body?.comboOfferId);
    if (!comboOfferId) {
      return res.status(400).json({ message: "Combo offer is required." });
    }

    const quantity = toNonNegativeQuantity(req.body?.quantity, 1);
    if (quantity === null) {
      return res.status(400).json({ message: "Quantity must be a positive integer." });
    }

    const cart = await addComboOfferToCart({
      customerRef,
      comboOfferId,
      quantity,
    });

    return res.status(201).json({ customerRef, cart });
  } catch (error) {
    next(error);
  }
});

app.put("/api/cart/items/:itemId", async (req, res, next) => {
  try {
    const resolved = await resolveScopedCustomerRef(req, {
      requireAuthenticated: true,
      authRequiredMessage: "Login required before updating cart items.",
      requireReference: true,
    });
    if (respondWithCustomerRefError(res, resolved.error)) {
      return;
    }
    const customerRef = resolved.customerRef;

    const itemId = cleanText(req.params.itemId);
    if (!itemId) {
      return res.status(400).json({ message: "Cart item id is required." });
    }

    const quantity = toNonNegativeInt(req.body?.quantity, 0);
    if (quantity === null) {
      return res.status(400).json({ message: "Quantity must be a non-negative integer." });
    }

    const cart = await updateCartItemQuantity({
      customerRef,
      itemId,
      quantity,
    });

    return res.json({ customerRef, cart });
  } catch (error) {
    next(error);
  }
});

app.put("/api/cart/combo-items/:itemId", async (req, res, next) => {
  try {
    const resolved = await resolveScopedCustomerRef(req, {
      requireAuthenticated: true,
      authRequiredMessage: "Login required before updating combo items.",
      requireReference: true,
    });
    if (respondWithCustomerRefError(res, resolved.error)) {
      return;
    }
    const customerRef = resolved.customerRef;

    const itemId = cleanText(req.params.itemId);
    if (!itemId) {
      return res.status(400).json({ message: "Combo item id is required." });
    }

    const quantity = toNonNegativeInt(req.body?.quantity, 0);
    if (quantity === null) {
      return res.status(400).json({ message: "Quantity must be a non-negative integer." });
    }

    const cart = await updateCartComboItemQuantity({
      customerRef,
      itemId,
      quantity,
    });

    return res.json({ customerRef, cart });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/cart/items/:itemId", async (req, res, next) => {
  try {
    const resolved = await resolveScopedCustomerRef(req, {
      requireAuthenticated: true,
      authRequiredMessage: "Login required before removing cart items.",
      requireReference: true,
    });
    if (respondWithCustomerRefError(res, resolved.error)) {
      return;
    }
    const customerRef = resolved.customerRef;

    const itemId = cleanText(req.params.itemId);
    if (!itemId) {
      return res.status(400).json({ message: "Cart item id is required." });
    }

    const cart = await removeCartItem({
      customerRef,
      itemId,
    });

    return res.json({ customerRef, cart });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/cart/combo-items/:itemId", async (req, res, next) => {
  try {
    const resolved = await resolveScopedCustomerRef(req, {
      requireAuthenticated: true,
      authRequiredMessage: "Login required before removing combo items.",
      requireReference: true,
    });
    if (respondWithCustomerRefError(res, resolved.error)) {
      return;
    }
    const customerRef = resolved.customerRef;

    const itemId = cleanText(req.params.itemId);
    if (!itemId) {
      return res.status(400).json({ message: "Combo item id is required." });
    }

    const cart = await removeCartComboItem({
      customerRef,
      itemId,
    });

    return res.json({ customerRef, cart });
  } catch (error) {
    next(error);
  }
});

app.post("/api/checkout", async (req, res, next) => {
  try {
    const authSession = await requireAuthenticatedSession(req, res);
    if (!authSession) {
      return;
    }

    const customerRef = authSession.user.id;
    const customerName = cleanText(req.body?.customerName) || cleanText(authSession.user.fullName);
    const customerEmail = cleanText(req.body?.customerEmail) || cleanText(authSession.user.email);
    const customerPhone = cleanText(req.body?.customerPhone) || authSession.user.phone;
    const paymentMethod = cleanText(req.body?.paymentMethod).toLowerCase() || "cod";
    const shippingAddress =
      req.body?.shippingAddress && typeof req.body.shippingAddress === "object" ? req.body.shippingAddress : {};

    if (!customerName || !customerEmail) {
      return res.status(400).json({ message: "Customer name and email are required for checkout." });
    }

    if (paymentMethod === "razorpay") {
      return res.status(400).json({
        message: "For Razorpay payments use /api/payments/razorpay/verify-and-checkout.",
      });
    }

    const order = await createOrderFromCart({
      customerRef,
      customerName,
      customerEmail,
      customerPhone,
      paymentMethod,
      paymentStatus: "pending",
      paymentGateway: "",
      gatewayOrderId: "",
      gatewayPaymentId: "",
      gatewaySignature: "",
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

app.get("/api/orders", async (req, res, next) => {
  try {
    const resolved = await resolveScopedCustomerRef(req, {
      requireAuthenticated: true,
      authRequiredMessage: "Login required before viewing orders.",
      requireReference: true,
    });
    if (respondWithCustomerRefError(res, resolved.error)) {
      return;
    }
    const customerRef = resolved.customerRef;

    const orders = await getOrdersByCustomerRef(customerRef);
    return res.json({ customerRef, orders });
  } catch (error) {
    next(error);
  }
});

app.get("/api/orders/:id", async (req, res, next) => {
  try {
    const authSession = await requireAuthenticatedSession(req, res);
    if (!authSession) {
      return;
    }

    const orderId = cleanText(req.params.id);
    if (!orderId) {
      return res.status(400).json({ message: "Order id is required." });
    }

    const order = await findOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.customerRef !== authSession.user.id) {
      return res.status(403).json({ message: "You can only access your own orders." });
    }

    return res.json(order);
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders/:id/tracking/refresh", async (req, res, next) => {
  try {
    const authSession = await requireAuthenticatedSession(req, res);
    if (!authSession) {
      return;
    }

    const orderId = cleanText(req.params.id);
    if (!orderId) {
      return res.status(400).json({ message: "Order id is required." });
    }

    const order = await findOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.customerRef !== authSession.user.id) {
      return res.status(403).json({ message: "You can only refresh your own order tracking." });
    }

    if (!order.fulfillment?.awbCode) {
      return res.status(400).json({ message: "Tracking is not available for this order yet." });
    }

    const updatedOrder = await refreshShiprocketTrackingForOrder(order.id);
    return res.json(updatedOrder);
  } catch (error) {
    next(error);
  }
});

app.get(["/api/admin/orders", "/admin/orders"], requireAdminAccess, async (req, res, next) => {
  try {
    const queryStatus = cleanText(Array.isArray(req.query?.status) ? req.query.status[0] : req.query?.status).toLowerCase();
    const queryPaymentStatus = cleanText(
      Array.isArray(req.query?.paymentStatus) ? req.query.paymentStatus[0] : req.query?.paymentStatus,
    ).toLowerCase();
    const parsedLimit = toNonNegativeInt(Array.isArray(req.query?.limit) ? req.query.limit[0] : req.query?.limit, 50);
    const parsedOffset = toNonNegativeInt(Array.isArray(req.query?.offset) ? req.query.offset[0] : req.query?.offset, 0);
    const limit = Math.max(1, Math.min(parsedLimit ?? 50, 200));
    const offset = Math.max(0, parsedOffset ?? 0);

    if (queryStatus && !ORDER_STATUSES.has(queryStatus)) {
      return res.status(400).json({ message: `Invalid order status filter: ${queryStatus}` });
    }

    if (queryPaymentStatus && !ORDER_PAYMENT_STATUSES.has(queryPaymentStatus)) {
      return res.status(400).json({ message: `Invalid payment status filter: ${queryPaymentStatus}` });
    }

    const payload = await getOrdersForAdmin({
      status: queryStatus,
      paymentStatus: queryPaymentStatus,
      limit,
      offset,
    });
    return res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get(["/api/admin/orders/:id", "/admin/orders/:id"], requireAdminAccess, async (req, res, next) => {
  try {
    const orderId = cleanText(req.params.id);
    if (!orderId) {
      return res.status(400).json({ message: "Order id is required." });
    }

    const order = await findOrderById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    return res.json(order);
  } catch (error) {
    next(error);
  }
});

app.put(["/api/admin/orders/:id/status", "/admin/orders/:id/status"], requireAdminAccess, async (req, res, next) => {
  try {
    const orderId = cleanText(req.params.id);
    const status = cleanText(req.body?.status).toLowerCase();
    const paymentStatus = cleanText(req.body?.paymentStatus).toLowerCase();
    if (!orderId) {
      return res.status(400).json({ message: "Order id is required." });
    }

    if (!status && !paymentStatus) {
      return res.status(400).json({ message: "At least one of status or paymentStatus is required." });
    }

    if (status && !ORDER_STATUSES.has(status)) {
      return res.status(400).json({ message: `Invalid order status: ${status}` });
    }

    if (paymentStatus && !ORDER_PAYMENT_STATUSES.has(paymentStatus)) {
      return res.status(400).json({ message: `Invalid payment status: ${paymentStatus}` });
    }

    const updatedOrder = await updateOrderById(orderId, {
      status,
      paymentStatus,
    });
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found." });
    }

    return res.json(updatedOrder);
  } catch (error) {
    next(error);
  }
});

app.post(["/api/admin/orders/:id/shiprocket", "/admin/orders/:id/shiprocket"], requireAdminAccess, async (req, res, next) => {
  try {
    const orderId = cleanText(req.params.id);
    if (!orderId) {
      return res.status(400).json({ message: "Order id is required." });
    }

    const order = await createShiprocketOrderForOrder(orderId, {
      force: req.body?.force === true,
      pickupLocation: req.body?.pickupLocation,
      channelId: req.body?.channelId,
      externalOrderId: req.body?.externalOrderId,
      length: req.body?.length,
      breadth: req.body?.breadth,
      height: req.body?.height,
      weight: req.body?.weight,
    });

    return res.json(order);
  } catch (error) {
    next(error);
  }
});

app.post(["/api/admin/orders/:id/shiprocket/awb", "/admin/orders/:id/shiprocket/awb"], requireAdminAccess, async (req, res, next) => {
  try {
    const orderId = cleanText(req.params.id);
    if (!orderId) {
      return res.status(400).json({ message: "Order id is required." });
    }

    const order = await assignShiprocketAwbForOrder(orderId, {
      courierId: req.body?.courierId,
      shipmentId: req.body?.shipmentId,
      force: req.body?.force === true,
      reassign: req.body?.reassign === true,
    });

    return res.json(order);
  } catch (error) {
    next(error);
  }
});

app.post(["/api/admin/orders/:id/shiprocket/tracking", "/admin/orders/:id/shiprocket/tracking"], requireAdminAccess, async (req, res, next) => {
  try {
    const orderId = cleanText(req.params.id);
    if (!orderId) {
      return res.status(400).json({ message: "Order id is required." });
    }

    const order = await refreshShiprocketTrackingForOrder(orderId, {
      awbCode: req.body?.awbCode,
    });

    return res.json(order);
  } catch (error) {
    next(error);
  }
});


export default app;
