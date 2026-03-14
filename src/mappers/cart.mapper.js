import { toIsoString } from "../utils/dates.js";

export function mapCartItem(row) {
  if (!row) {
    return null;
  }

  const unitPrice = Number(row.unitPrice);
  const quantity = Number(row.quantity);
  const lineTotal = Number(row.lineTotal ?? unitPrice * quantity);

  return {
    id: row.id,
    cartId: row.cartId,
    productId: row.productId,
    quantity,
    unitPrice,
    lineTotal,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    product: {
      id: row.productId,
      name: row.productName ?? "",
      description: row.productDescription ?? "",
      imageUrl: row.productImageUrl ?? "",
      sku: row.productSku ?? "",
      stock: Number(row.productStock ?? 0),
      isActive: Boolean(row.productIsActive),
      category: row.categoryId
        ? {
            id: row.categoryId,
            name: row.categoryName ?? "",
          }
        : null,
    },
  };
}

export function mapCartComboItem(row) {
  if (!row) {
    return null;
  }

  let products = [];
  if (typeof row.productsJson === "string" && row.productsJson.trim()) {
    try {
      const parsed = JSON.parse(row.productsJson);
      if (Array.isArray(parsed)) {
        products = parsed
          .map((entry) => ({
            productId: entry?.productId ?? "",
            name: entry?.name ?? "",
            imageUrl: entry?.imageUrl ?? "",
            price: Number(entry?.price ?? 0),
            quantity: Number(entry?.quantity ?? 1),
          }))
          .filter((entry) => Boolean(entry.productId));
      }
    } catch {
      products = [];
    }
  }

  const unitPrice = Number(row.unitPrice);
  const quantity = Number(row.quantity);
  const lineTotal = Number(row.lineTotal ?? unitPrice * quantity);

  return {
    id: row.id,
    cartId: row.cartId,
    comboOfferId: row.comboOfferId,
    comboTitle: row.comboTitle ?? "",
    bannerImageUrl: row.bannerImageUrl ?? "",
    products,
    quantity,
    unitPrice,
    lineTotal,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export function mapCart(cartRow, itemRows, comboItemRows = []) {
  if (!cartRow) {
    return null;
  }

  const items = itemRows.map(mapCartItem).filter(Boolean);
  const comboItems = comboItemRows.map(mapCartComboItem).filter(Boolean);
  const productSubtotal = items.reduce((acc, item) => acc + Number(item.lineTotal || 0), 0);
  const comboSubtotal = comboItems.reduce((acc, item) => acc + Number(item.lineTotal || 0), 0);
  const subtotal = productSubtotal + comboSubtotal;
  const itemCount = items.length + comboItems.length;
  const totalQuantity =
    items.reduce((acc, item) => acc + Number(item.quantity || 0), 0) +
    comboItems.reduce((acc, item) => acc + Number(item.quantity || 0), 0);

  return {
    id: cartRow.id,
    customerRef: cartRow.customerRef,
    status: cartRow.status,
    itemCount,
    totalQuantity,
    subtotal: Number(subtotal.toFixed(2)),
    items,
    comboItems,
    createdAt: toIsoString(cartRow.createdAt),
    updatedAt: toIsoString(cartRow.updatedAt),
  };
}
