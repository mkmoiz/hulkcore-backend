import { createId } from "../utils.js";
import { getPrisma } from "../db/prisma.js";
import { mapCart } from "../mappers/cart.mapper.js";
import { createStoreError } from "../utils/errors.js";
import { normalizeCustomerRef } from "../utils/normalize.js";

export async function findActiveCartRowByCustomerRef(customerRef, prismaClient = getPrisma()) {
  const row = await prismaClient.cart.findFirst({
    where: { customerRef, status: "active" },
    orderBy: { updatedAt: "desc" },
  });

  return row ?? null;
}

export async function findCartRowById(cartId, prismaClient = getPrisma()) {
  const row = await prismaClient.cart.findUnique({
    where: { id: cartId },
  });

  return row ?? null;
}

export async function findCartItemRowsByCartId(cartId, prismaClient = getPrisma()) {
  const rows = await prismaClient.cartItem.findMany({
    where: { cartId },
    include: {
      product: {
        include: { category: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Map to the flat structure the mapper expects
  return rows.map((row) => ({
    id: row.id,
    cartId: row.cartId,
    productId: row.productId,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    lineTotal: Number(row.quantity) * Number(row.unitPrice),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    productName: row.product?.name ?? "",
    productDescription: row.product?.description ?? "",
    productImageUrl: row.product?.imageUrl ?? "",
    productSku: row.product?.sku ?? "",
    productStock: row.product?.stock ?? 0,
    productIsActive: row.product?.isActive,
    categoryId: row.product?.category?.id ?? null,
    categoryName: row.product?.category?.name ?? "",
  }));
}

export async function findCartComboItemRowsByCartId(cartId, prismaClient = getPrisma()) {
  const rows = await prismaClient.cartComboItem.findMany({
    where: { cartId },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    cartId: row.cartId,
    comboOfferId: row.comboOfferId,
    comboTitle: row.comboTitle,
    bannerImageUrl: row.bannerImageUrl,
    productsJson: row.productsJson,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    lineTotal: Number(row.quantity) * Number(row.unitPrice),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function touchCart(cartId, prismaClient = getPrisma()) {
  const now = new Date();
  await prismaClient.cart.update({
    where: { id: cartId },
    data: { updatedAt: now },
  });
}

export async function createActiveCartRow(customerRef, prismaClient = getPrisma()) {
  const now = new Date();
  const cartId = createId("cart");

  await prismaClient.cart.create({
    data: {
      id: cartId,
      customerRef,
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
  });

  return findCartRowById(cartId, prismaClient);
}

export async function getOrCreateActiveCartRow(customerRef, prismaClient = getPrisma()) {
  const normalizedCustomerRef = normalizeCustomerRef(customerRef);
  if (!normalizedCustomerRef) {
    throw createStoreError("Customer reference is required.", "CART_CUSTOMER_REF_REQUIRED", 400);
  }

  const existingCart = await findActiveCartRowByCustomerRef(normalizedCustomerRef, prismaClient);
  if (existingCart) {
    return existingCart;
  }

  return createActiveCartRow(normalizedCustomerRef, prismaClient);
}

export async function getCartById(cartId, prismaClient = getPrisma()) {
  const cartRow = await findCartRowById(cartId, prismaClient);
  if (!cartRow) {
    return null;
  }

  const [cartItemRows, cartComboRows] = await Promise.all([
    findCartItemRowsByCartId(cartId, prismaClient),
    findCartComboItemRowsByCartId(cartId, prismaClient),
  ]);
  return mapCart(cartRow, cartItemRows, cartComboRows);
}

export async function findExistingCartItemRow(cartId, productId) {
  const row = await getPrisma().cartItem.findFirst({
    where: { cartId, productId },
    select: { id: true, quantity: true },
  });

  return row ?? null;
}

export async function findExistingCartComboItemRow(cartId, comboOfferId) {
  const row = await getPrisma().cartComboItem.findFirst({
    where: { cartId, comboOfferId },
    select: { id: true, quantity: true },
  });

  return row ?? null;
}

export async function findCartItemForCart(itemId, cartId) {
  const row = await getPrisma().cartItem.findFirst({
    where: { id: itemId, cartId },
    select: { id: true, productId: true },
  });

  return row ?? null;
}

export async function findCartComboItemForCart(itemId, cartId) {
  const row = await getPrisma().cartComboItem.findFirst({
    where: { id: itemId, cartId },
    select: { id: true, comboOfferId: true },
  });

  return row ?? null;
}

export async function updateCartItemRow(itemId, quantity, unitPrice, now = new Date()) {
  await getPrisma().cartItem.update({
    where: { id: itemId },
    data: { quantity, unitPrice, updatedAt: now },
  });
}

export async function updateCartComboItemRow(itemId, quantity, unitPrice, now = new Date()) {
  await getPrisma().cartComboItem.update({
    where: { id: itemId },
    data: { quantity, unitPrice, updatedAt: now },
  });
}

export async function insertCartItemRow(entry, now = new Date()) {
  await getPrisma().cartItem.create({
    data: {
      id: entry.id,
      cartId: entry.cartId,
      productId: entry.productId,
      quantity: entry.quantity,
      unitPrice: entry.unitPrice,
      createdAt: now,
      updatedAt: now,
    },
  });
}

export async function insertCartComboItemRow(entry, now = new Date()) {
  await getPrisma().cartComboItem.create({
    data: {
      id: entry.id,
      cartId: entry.cartId,
      comboOfferId: entry.comboOfferId,
      comboTitle: entry.comboTitle,
      bannerImageUrl: entry.bannerImageUrl,
      productsJson: entry.productsJson,
      quantity: entry.quantity,
      unitPrice: entry.unitPrice,
      createdAt: now,
      updatedAt: now,
    },
  });
}

export async function deleteCartItemById(itemId) {
  await getPrisma().cartItem.delete({
    where: { id: itemId },
  });
}

export async function deleteCartComboItemByIdAndCartId(itemId, cartId) {
  try {
    await getPrisma().cartComboItem.delete({
      where: { id: itemId },
    });
    return true;
  } catch (error) {
    if (error.code === "P2025") {
      return false;
    }
    throw error;
  }
}

export async function deleteCartItemByIdAndCartId(itemId, cartId) {
  try {
    await getPrisma().cartItem.delete({
      where: { id: itemId },
    });
    return true;
  } catch (error) {
    if (error.code === "P2025") {
      return false;
    }
    throw error;
  }
}

export async function markCartCheckedOut(cartId, now, prismaClient = getPrisma()) {
  await prismaClient.cart.update({
    where: { id: cartId },
    data: { status: "checked_out", updatedAt: now },
  });
}
