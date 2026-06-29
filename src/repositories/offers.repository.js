import { createId } from "../utils.js";
import { getPrisma } from "../db/prisma.js";
import { mapProduct } from "../mappers/product.mapper.js";
import { toIsoString } from "../utils/dates.js";
import { findProductImageRowsByProductIds, groupProductImageRowsByProductId } from "./product-images.repository.js";

export async function getOfferProducts(includeHidden = true) {
  const where = includeHidden ? {} : { isActive: true };
  const rows = await getPrisma().offerProduct.findMany({
    where,
    include: {
      product: {
        include: { category: true },
      },
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  const productIds = rows.map((row) => row.product?.id).filter(Boolean);
  const imageRows = await findProductImageRowsByProductIds(productIds);
  const imagesByProductId = groupProductImageRowsByProductId(imageRows);

  return rows.map((row, index) => ({
    id: row.id,
    productId: row.productId,
    badge: row.badge ?? "",
    subtitle: row.subtitle ?? "",
    position: Number(row.position ?? index),
    isActive: Boolean(row.isActive),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    product: mapProduct(
      {
        id: row.product?.id,
        name: row.product?.name,
        description: row.product?.description,
        imageUrl: row.product?.imageUrl,
        imageKey: row.product?.imageKey,
        sku: row.product?.sku,
        badge: row.product?.badge,
        subtitle: row.product?.subtitle,
        categoryId: row.product?.categoryId,
        price: row.product?.price,
        originalPrice: row.product?.originalPrice,
        offerPrice: row.product?.offerPrice,
        stock: row.product?.stock,
        isActive: row.product?.isActive,
        createdAt: row.product?.createdAt,
        updatedAt: row.product?.updatedAt,
        categoryIdRef: row.product?.category?.id,
        categoryName: row.product?.category?.name,
        categorySlug: row.product?.category?.slug,
      },
      imagesByProductId[row.product?.id] ?? [],
    ),
  }));
}

export async function replaceOfferProducts(entries) {
  await getPrisma().$transaction(async (tx) => {
    await tx.offerProduct.deleteMany();
    const now = new Date();
    const records = [];
    for (const [index, entry] of entries.entries()) {
      records.push({
        id: createId("ofp"),
        productId: entry.productId,
        badge: entry.badge ?? "",
        subtitle: entry.subtitle ?? "",
        position: index,
        isActive: entry.isActive ? true : false,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (records.length > 0) {
      await tx.offerProduct.createMany({
        data: records,
      });
    }
  });

  return getOfferProducts(true);
}
