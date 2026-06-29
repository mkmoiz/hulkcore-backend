import { getPrisma } from "../db/prisma.js";
import { mapProductImage } from "../mappers/product.mapper.js";

export async function findProductImageRowsByProductIds(productIds, prismaClient = getPrisma()) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return [];
  }

  const rows = await prismaClient.productImage.findMany({
    where: { productId: { in: productIds } },
    orderBy: [{ productId: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return rows;
}

export function groupProductImageRowsByProductId(rows) {
  return rows.reduce((acc, row) => {
    const mapped = mapProductImage(row);
    if (!mapped) {
      return acc;
    }

    if (!acc[mapped.productId]) {
      acc[mapped.productId] = [];
    }

    acc[mapped.productId].push(mapped);
    return acc;
  }, {});
}

export async function replaceProductImagesByProductId(productId, images, prismaClient = getPrisma()) {
  await prismaClient.productImage.deleteMany({
    where: { productId },
  });

  if (!Array.isArray(images) || images.length === 0) {
    return;
  }

  const { createId } = await import("../utils.js");
  const now = new Date();
  const records = images.map((image) => ({
    id: createId("pimg"),
    productId,
    imageUrl: image.imageUrl,
    imageKey: image.imageKey ?? "",
    sortOrder: image.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  }));

  if (records.length > 0) {
    await prismaClient.productImage.createMany({
      data: records,
    });
  }
}
