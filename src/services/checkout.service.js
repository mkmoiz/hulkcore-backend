import { createId } from "../utils.js";
import { getPrisma } from "../db/prisma.js";
import { createStoreError } from "../utils/errors.js";
import { normalizeCustomerRef, normalizeText } from "../utils/normalize.js";
import {
  findCartComboItemRowsByCartId,
  findCartItemRowsByCartId,
  getOrCreateActiveCartRow,
  markCartCheckedOut,
} from "../repositories/carts.repository.js";
import {
  decrementProductStock,
  findOrderByGatewayOrderId,
  findOrderByGatewayPaymentId,
  findOrderById,
  findProductForCheckout,
  findProductsForCheckout,
  getOrdersByCustomerRef,
  getOrdersForAdmin,
  insertOrderComboItemRow,
  insertOrderItemRow,
  insertOrderRow,
  updateOrderById,
} from "../repositories/orders.repository.js";

export {
  findOrderById,
  findOrderByGatewayOrderId,
  findOrderByGatewayPaymentId,
  getOrdersByCustomerRef,
  getOrdersForAdmin,
  updateOrderById,
};

function parseComboProductsSnapshot(productsJson) {
  if (typeof productsJson !== "string" || !productsJson.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(productsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => {
        const productId = normalizeText(entry?.productId);
        if (!productId) {
          return null;
        }

        const productQuantity = Number(entry?.quantity ?? 1);
        const normalizedQuantity =
          Number.isInteger(productQuantity) && productQuantity > 0 ? productQuantity : 1;
        return {
          productId,
          name: normalizeText(entry?.name),
          imageUrl: normalizeText(entry?.imageUrl),
          price: Number(entry?.price ?? 0),
          quantity: normalizedQuantity,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function createOrderFromCart(input) {
  const customerRef = normalizeCustomerRef(input?.customerRef);
  const customerName = normalizeText(input?.customerName);
  const customerEmail = normalizeText(input?.customerEmail);
  const customerPhone = normalizeText(input?.customerPhone);
  const paymentMethod = normalizeText(input?.paymentMethod, "cod").toLowerCase();
  const paymentStatus = normalizeText(
    input?.paymentStatus,
    paymentMethod === "razorpay" ? "paid" : "pending",
  ).toLowerCase();
  const status = normalizeText(input?.status, "placed").toLowerCase();
  const paymentGateway = normalizeText(input?.paymentGateway).toLowerCase();
  const gatewayOrderId = normalizeText(input?.gatewayOrderId);
  const gatewayPaymentId = normalizeText(input?.gatewayPaymentId);
  const gatewaySignature = normalizeText(input?.gatewaySignature);
  const currency = normalizeText(input?.currency, "INR").toUpperCase();
  const shippingAddress = input?.shippingAddress && typeof input.shippingAddress === "object" ? input.shippingAddress : {};
  const shippingFee = Number(input?.shippingFee ?? 0);
  const finalizeCart = input?.finalizeCart !== false;

  if (!customerRef) {
    throw createStoreError("Customer reference is required.", "CART_CUSTOMER_REF_REQUIRED", 400);
  }

  if (!customerName || !customerEmail) {
    throw createStoreError("Customer name and email are required for checkout.", "CHECKOUT_CUSTOMER_REQUIRED", 400);
  }

  const orderId = createId("ord");

  await getPrisma().$transaction(async (tx) => {
    const cartRow = await getOrCreateActiveCartRow(customerRef, tx);
    const [itemRows, comboItemRows] = await Promise.all([
      findCartItemRowsByCartId(cartRow.id, tx),
      findCartComboItemRowsByCartId(cartRow.id, tx),
    ]);
    if (itemRows.length === 0 && comboItemRows.length === 0) {
      throw createStoreError("Cart is empty.", "CHECKOUT_CART_EMPTY", 409);
    }

    const allProductIds = new Set();
    for (const row of itemRows) {
      const normalizedProductId = normalizeText(row.productId);
      if (normalizedProductId) {
        allProductIds.add(normalizedProductId);
      }
    }
    for (const row of comboItemRows) {
      const comboProducts = parseComboProductsSnapshot(row.productsJson);
      for (const comboProduct of comboProducts) {
        const normalizedProductId = normalizeText(comboProduct.productId);
        if (normalizedProductId) {
          allProductIds.add(normalizedProductId);
        }
      }
    }

    const fetchedProducts = await findProductsForCheckout(Array.from(allProductIds), tx);
    const lockedProductsById = new Map(fetchedProducts.map((p) => [p.id, p]));

    const preparedItems = [];
    const preparedComboItems = [];
    let subtotal = 0;
    const requiredStockByProductId = new Map();

    function getLockedProductOrThrow(productId, fallbackName) {
      const normalizedProductId = normalizeText(productId);
      if (!normalizedProductId) {
        throw createStoreError("Invalid product reference in cart.", "CHECKOUT_PRODUCT_UNAVAILABLE", 409);
      }

      const product = lockedProductsById.get(normalizedProductId);
      if (!product || !Boolean(product.isActive)) {
        throw createStoreError(
          `Product is unavailable: ${fallbackName || normalizedProductId}`,
          "CHECKOUT_PRODUCT_UNAVAILABLE",
          409,
        );
      }

      return product;
    }

    function addRequiredStock(productId, quantity) {
      const current = Number(requiredStockByProductId.get(productId) ?? 0);
      requiredStockByProductId.set(productId, current + Number(quantity));
    }

    for (const row of itemRows) {
      const product = getLockedProductOrThrow(row.productId, row.productName);
      const unitPrice = Number(product.price);
      const quantity = Number(row.quantity);
      const lineTotal = Number((unitPrice * quantity).toFixed(2));
      subtotal += lineTotal;
      addRequiredStock(product.id, quantity);

      preparedItems.push({
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice,
        lineTotal,
      });
    }

    for (const row of comboItemRows) {
      const quantity = Number(row.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        continue;
      }

      const comboProducts = parseComboProductsSnapshot(row.productsJson);
      if (comboProducts.length < 2) {
        throw createStoreError(
          `Combo offer is invalid: ${row.comboTitle || row.comboOfferId}`,
          "CHECKOUT_COMBO_INVALID",
          409,
        );
      }

      for (const comboProduct of comboProducts) {
        const lockedProduct = getLockedProductOrThrow(comboProduct.productId, comboProduct.name);
        addRequiredStock(lockedProduct.id, quantity * Number(comboProduct.quantity ?? 1));
      }

      const unitPrice = Number(row.unitPrice);
      const lineTotal = Number((unitPrice * quantity).toFixed(2));
      subtotal += lineTotal;

      preparedComboItems.push({
        comboOfferId: normalizeText(row.comboOfferId),
        comboTitle: normalizeText(row.comboTitle),
        bannerImageUrl: normalizeText(row.bannerImageUrl),
        products: comboProducts,
        quantity,
        unitPrice,
        lineTotal,
      });
    }

    for (const [productId, requiredQuantity] of requiredStockByProductId.entries()) {
      const lockedProduct = lockedProductsById.get(productId);
      if (!lockedProduct) {
        continue;
      }

      if (Number(lockedProduct.stock) < Number(requiredQuantity)) {
        throw createStoreError(`Insufficient stock for ${lockedProduct.name}.`, "CHECKOUT_STOCK_SHORTAGE", 409);
      }
    }

    const normalizedShippingFee = Number.isFinite(shippingFee) && shippingFee >= 0 ? Number(shippingFee.toFixed(2)) : 0;
    const normalizedSubtotal = Number(subtotal.toFixed(2));
    const total = Number((normalizedSubtotal + normalizedShippingFee).toFixed(2));
    const now = new Date();

    await insertOrderRow(
      {
        orderId,
        cartId: cartRow.id,
        customerRef,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddressJson: JSON.stringify(shippingAddress),
        paymentMethod: paymentMethod || "cod",
        paymentStatus: paymentStatus || "pending",
        paymentGateway: paymentGateway || "",
        gatewayOrderId: gatewayOrderId || "",
        gatewayPaymentId: gatewayPaymentId || "",
        gatewaySignature: gatewaySignature || "",
        fulfillmentProvider: "",
        fulfillmentOrderId: "",
        fulfillmentShipmentId: "",
        fulfillmentAwbCode: "",
        fulfillmentCourierName: "",
        fulfillmentStatus: "",
        fulfillmentSyncedAt: null,
        fulfillmentPayloadJson: null,
        currency: currency || "INR",
        status: status || "placed",
        subtotal: normalizedSubtotal,
        shippingFee: normalizedShippingFee,
        total,
        now,
      },
      tx,
    );

    const orderItemEntries = preparedItems.map((item) => ({
      id: createId("orditem"),
      orderId,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    }));
    await insertOrderItemRow(orderItemEntries, now, tx);

    const orderComboItemEntries = preparedComboItems.map((comboItem) => ({
      id: createId("ordcombo"),
      orderId,
      comboOfferId: comboItem.comboOfferId || "",
      comboTitle: comboItem.comboTitle || "Combo Offer",
      comboDescription: "",
      bannerImageUrl: comboItem.bannerImageUrl,
      productsJson: JSON.stringify(comboItem.products),
      quantity: comboItem.quantity,
      unitPrice: comboItem.unitPrice,
      lineTotal: comboItem.lineTotal,
    }));
    await insertOrderComboItemRow(orderComboItemEntries, now, tx);

    if (finalizeCart) {
      const stockDecrementPromises = [];
      for (const [productId, requiredQuantity] of requiredStockByProductId.entries()) {
        stockDecrementPromises.push(decrementProductStock(productId, requiredQuantity, now, tx));
      }
      await Promise.all(stockDecrementPromises);
    }

    if (finalizeCart) {
      await markCartCheckedOut(cartRow.id, now, tx);
    }

    if (finalizeCart) {
      await markCartCheckedOut(cartRow.id, now, tx);
    }
  });

  const createdOrder = await findOrderById(orderId);
  if (!createdOrder) {
    throw createStoreError("Order could not be loaded after checkout.", "CHECKOUT_ORDER_LOAD_FAILED", 500);
  }

  return createdOrder;
}
