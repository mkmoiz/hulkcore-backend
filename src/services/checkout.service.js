import { createId } from "../utils.js";
import { getPool } from "../db/connection.js";
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

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const cartRow = await getOrCreateActiveCartRow(customerRef, connection);
    const [itemRows, comboItemRows] = await Promise.all([
      findCartItemRowsByCartId(cartRow.id, connection),
      findCartComboItemRowsByCartId(cartRow.id, connection),
    ]);
    if (itemRows.length === 0 && comboItemRows.length === 0) {
      throw createStoreError("Cart is empty.", "CHECKOUT_CART_EMPTY", 409);
    }

    const preparedItems = [];
    const preparedComboItems = [];
    let subtotal = 0;
    const requiredStockByProductId = new Map();
    const lockedProductsById = new Map();

    async function getLockedProductOrThrow(productId, fallbackName) {
      const normalizedProductId = normalizeText(productId);
      if (!normalizedProductId) {
        throw createStoreError("Invalid product reference in cart.", "CHECKOUT_PRODUCT_UNAVAILABLE", 409);
      }

      if (lockedProductsById.has(normalizedProductId)) {
        return lockedProductsById.get(normalizedProductId);
      }

      const product = await findProductForCheckout(normalizedProductId, connection);
      if (!product || !Boolean(product.isActive)) {
        throw createStoreError(
          `Product is unavailable: ${fallbackName || normalizedProductId}`,
          "CHECKOUT_PRODUCT_UNAVAILABLE",
          409,
        );
      }

      lockedProductsById.set(normalizedProductId, product);
      return product;
    }

    function addRequiredStock(productId, quantity) {
      const current = Number(requiredStockByProductId.get(productId) ?? 0);
      requiredStockByProductId.set(productId, current + Number(quantity));
    }

    for (const row of itemRows) {
      const product = await getLockedProductOrThrow(row.productId, row.productName);
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
        const lockedProduct = await getLockedProductOrThrow(comboProduct.productId, comboProduct.name);
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
    const orderId = createId("ord");

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
      connection,
    );

    for (const item of preparedItems) {
      await insertOrderItemRow(
        {
          id: createId("orditem"),
          orderId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        },
        now,
        connection,
      );
    }

    for (const comboItem of preparedComboItems) {
      await insertOrderComboItemRow(
        {
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
        },
        now,
        connection,
      );
    }

    if (finalizeCart) {
      for (const [productId, requiredQuantity] of requiredStockByProductId.entries()) {
        await decrementProductStock(productId, requiredQuantity, now, connection);
      }
    }

    if (finalizeCart) {
      await markCartCheckedOut(cartRow.id, now, connection);
    }

    await connection.commit();

    const createdOrder = await findOrderById(orderId);
    if (!createdOrder) {
      throw createStoreError("Order could not be loaded after checkout.", "CHECKOUT_ORDER_LOAD_FAILED", 500);
    }

    return createdOrder;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
