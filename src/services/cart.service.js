import { createId } from "../utils.js";
import { createStoreError } from "../utils/errors.js";
import { normalizeCustomerRef, normalizeText } from "../utils/normalize.js";
import {
  deleteCartItemById,
  deleteCartComboItemByIdAndCartId,
  deleteCartItemByIdAndCartId,
  findCartComboItemForCart,
  findCartComboItemRowsByCartId,
  findCartItemForCart,
  findCartItemRowsByCartId,
  findExistingCartComboItemRow,
  findExistingCartItemRow,
  getOrCreateActiveCartRow,
  insertCartComboItemRow,
  insertCartItemRow,
  touchCart,
  updateCartComboItemRow,
  updateCartItemRow,
} from "../repositories/carts.repository.js";
import { mapCart } from "../mappers/cart.mapper.js";
import { findProductById } from "../repositories/products.repository.js";
import { findComboOfferById } from "../repositories/combo-offers.repository.js";

async function mapCartForRow(cartRow) {
  const [cartItemRows, cartComboRows] = await Promise.all([
    findCartItemRowsByCartId(cartRow.id),
    findCartComboItemRowsByCartId(cartRow.id),
  ]);

  return mapCart(cartRow, cartItemRows, cartComboRows);
}

export async function getOrCreateActiveCart(customerRef) {
  const normalizedCustomerRef = normalizeCustomerRef(customerRef);
  const cartRow = await getOrCreateActiveCartRow(normalizedCustomerRef);
  return mapCartForRow(cartRow);
}

export async function getCartByCustomerRef(customerRef) {
  const normalizedCustomerRef = normalizeCustomerRef(customerRef);
  if (!normalizedCustomerRef) {
    throw createStoreError("Customer reference is required.", "CART_CUSTOMER_REF_REQUIRED", 400);
  }

  const cartRow = await getOrCreateActiveCartRow(normalizedCustomerRef);
  return mapCartForRow(cartRow);
}

export async function addItemToCart(input) {
  const customerRef = normalizeCustomerRef(input?.customerRef);
  const productId = normalizeText(input?.productId);
  const quantity = Number(input?.quantity ?? 1);
  const normalizedQuantity = Number.isInteger(quantity) ? quantity : Math.floor(quantity);

  if (!customerRef) {
    throw createStoreError("Customer reference is required.", "CART_CUSTOMER_REF_REQUIRED", 400);
  }

  if (!productId) {
    throw createStoreError("Product is required.", "CART_PRODUCT_REQUIRED", 400);
  }

  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity <= 0) {
    throw createStoreError("Quantity must be a positive integer.", "CART_INVALID_QUANTITY", 400);
  }

  const cartRow = await getOrCreateActiveCartRow(customerRef);
  const product = await findProductById(productId);
  if (!product || !product.isActive) {
    throw createStoreError("Product is unavailable.", "CART_PRODUCT_UNAVAILABLE", 404);
  }

  if (product.stock <= 0) {
    throw createStoreError("Product is out of stock.", "CART_PRODUCT_OUT_OF_STOCK", 409);
  }

  const existingItem = await findExistingCartItemRow(cartRow.id, productId);

  const now = new Date();
  const nextQuantity = Math.min(
    Number(product.stock),
    (Number(existingItem?.quantity ?? 0) || 0) + normalizedQuantity,
  );

  if (existingItem) {
    await updateCartItemRow(existingItem.id, nextQuantity, Number(product.price), now);
  } else {
    await insertCartItemRow(
      {
        id: createId("cartitem"),
        cartId: cartRow.id,
        productId,
        quantity: nextQuantity,
        unitPrice: Number(product.price),
      },
      now,
    );
  }

  await touchCart(cartRow.id);
  return getCartByCustomerRef(customerRef);
}

export async function addComboOfferToCart(input) {
  const customerRef = normalizeCustomerRef(input?.customerRef);
  const comboOfferId = normalizeText(input?.comboOfferId);
  const quantity = Number(input?.quantity ?? 1);
  const normalizedQuantity = Number.isInteger(quantity) ? quantity : Math.floor(quantity);

  if (!customerRef) {
    throw createStoreError("Customer reference is required.", "CART_CUSTOMER_REF_REQUIRED", 400);
  }
  if (!comboOfferId) {
    throw createStoreError("Combo offer is required.", "CART_COMBO_REQUIRED", 400);
  }
  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity <= 0) {
    throw createStoreError("Quantity must be a positive integer.", "CART_INVALID_QUANTITY", 400);
  }

  const comboOffer = await findComboOfferById(comboOfferId, false);
  if (!comboOffer || comboOffer.status !== "active") {
    throw createStoreError("Combo offer is unavailable.", "CART_COMBO_UNAVAILABLE", 404);
  }
  if (!Array.isArray(comboOffer.products) || comboOffer.products.length < 2) {
    throw createStoreError("Combo offer is invalid.", "CART_COMBO_INVALID", 409);
  }

  const cartRow = await getOrCreateActiveCartRow(customerRef);
  const existingItem = await findExistingCartComboItemRow(cartRow.id, comboOfferId);
  const now = new Date();
  const nextQuantity = (Number(existingItem?.quantity ?? 0) || 0) + normalizedQuantity;

  const productsSnapshot = comboOffer.products.map((entry) => ({
    productId: entry.productId,
    name: entry.name,
    imageUrl: entry.imageUrl,
    price: Number(entry.price ?? 0),
    quantity: 1,
  }));

  if (existingItem) {
    await updateCartComboItemRow(existingItem.id, nextQuantity, Number(comboOffer.offerPrice), now);
  } else {
    await insertCartComboItemRow(
      {
        id: createId("cartcombo"),
        cartId: cartRow.id,
        comboOfferId,
        comboTitle: comboOffer.title,
        bannerImageUrl: comboOffer.bannerImageUrl,
        productsJson: JSON.stringify(productsSnapshot),
        quantity: nextQuantity,
        unitPrice: Number(comboOffer.offerPrice),
      },
      now,
    );
  }

  await touchCart(cartRow.id);
  return getCartByCustomerRef(customerRef);
}

export async function updateCartItemQuantity(input) {
  const customerRef = normalizeCustomerRef(input?.customerRef);
  const itemId = normalizeText(input?.itemId);
  const quantity = Number(input?.quantity);
  const normalizedQuantity = Number.isInteger(quantity) ? quantity : Math.floor(quantity);

  if (!customerRef) {
    throw createStoreError("Customer reference is required.", "CART_CUSTOMER_REF_REQUIRED", 400);
  }

  if (!itemId) {
    throw createStoreError("Cart item is required.", "CART_ITEM_REQUIRED", 400);
  }

  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 0) {
    throw createStoreError("Quantity must be a non-negative integer.", "CART_INVALID_QUANTITY", 400);
  }

  const cartRow = await getOrCreateActiveCartRow(customerRef);
  const itemRow = await findCartItemForCart(itemId, cartRow.id);

  if (!itemRow) {
    throw createStoreError("Cart item not found.", "CART_ITEM_NOT_FOUND", 404);
  }

  if (normalizedQuantity === 0) {
    await deleteCartItemById(itemId);
    await touchCart(cartRow.id);
    return getCartByCustomerRef(customerRef);
  }

  const product = await findProductById(itemRow.productId);
  if (!product || !product.isActive) {
    throw createStoreError("Product is unavailable.", "CART_PRODUCT_UNAVAILABLE", 404);
  }

  const nextQuantity = Math.min(normalizedQuantity, Number(product.stock));
  if (nextQuantity <= 0) {
    throw createStoreError("Product is out of stock.", "CART_PRODUCT_OUT_OF_STOCK", 409);
  }

  await updateCartItemRow(itemId, nextQuantity, Number(product.price), new Date());

  await touchCart(cartRow.id);
  return getCartByCustomerRef(customerRef);
}

export async function updateCartComboItemQuantity(input) {
  const customerRef = normalizeCustomerRef(input?.customerRef);
  const itemId = normalizeText(input?.itemId);
  const quantity = Number(input?.quantity);
  const normalizedQuantity = Number.isInteger(quantity) ? quantity : Math.floor(quantity);

  if (!customerRef) {
    throw createStoreError("Customer reference is required.", "CART_CUSTOMER_REF_REQUIRED", 400);
  }
  if (!itemId) {
    throw createStoreError("Combo item is required.", "CART_COMBO_ITEM_REQUIRED", 400);
  }
  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 0) {
    throw createStoreError("Quantity must be a non-negative integer.", "CART_INVALID_QUANTITY", 400);
  }

  const cartRow = await getOrCreateActiveCartRow(customerRef);
  const itemRow = await findCartComboItemForCart(itemId, cartRow.id);
  if (!itemRow) {
    throw createStoreError("Combo item not found.", "CART_COMBO_ITEM_NOT_FOUND", 404);
  }

  if (normalizedQuantity === 0) {
    await deleteCartComboItemByIdAndCartId(itemId, cartRow.id);
    await touchCart(cartRow.id);
    return getCartByCustomerRef(customerRef);
  }

  const comboOffer = await findComboOfferById(itemRow.comboOfferId, true);
  if (!comboOffer) {
    throw createStoreError("Combo offer not found.", "CART_COMBO_NOT_FOUND", 404);
  }

  await updateCartComboItemRow(itemId, normalizedQuantity, Number(comboOffer.offerPrice), new Date());
  await touchCart(cartRow.id);
  return getCartByCustomerRef(customerRef);
}

export async function removeCartItem(input) {
  const customerRef = normalizeCustomerRef(input?.customerRef);
  const itemId = normalizeText(input?.itemId);

  if (!customerRef) {
    throw createStoreError("Customer reference is required.", "CART_CUSTOMER_REF_REQUIRED", 400);
  }

  if (!itemId) {
    throw createStoreError("Cart item is required.", "CART_ITEM_REQUIRED", 400);
  }

  const cartRow = await getOrCreateActiveCartRow(customerRef);
  const deleted = await deleteCartItemByIdAndCartId(itemId, cartRow.id);

  if (!deleted) {
    throw createStoreError("Cart item not found.", "CART_ITEM_NOT_FOUND", 404);
  }

  await touchCart(cartRow.id);
  return getCartByCustomerRef(customerRef);
}

export async function removeCartComboItem(input) {
  const customerRef = normalizeCustomerRef(input?.customerRef);
  const itemId = normalizeText(input?.itemId);

  if (!customerRef) {
    throw createStoreError("Customer reference is required.", "CART_CUSTOMER_REF_REQUIRED", 400);
  }
  if (!itemId) {
    throw createStoreError("Combo item is required.", "CART_COMBO_ITEM_REQUIRED", 400);
  }

  const cartRow = await getOrCreateActiveCartRow(customerRef);
  const deleted = await deleteCartComboItemByIdAndCartId(itemId, cartRow.id);
  if (!deleted) {
    throw createStoreError("Combo item not found.", "CART_COMBO_ITEM_NOT_FOUND", 404);
  }

  await touchCart(cartRow.id);
  return getCartByCustomerRef(customerRef);
}
