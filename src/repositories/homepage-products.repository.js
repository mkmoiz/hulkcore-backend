import { createId } from "../utils.js";
import { getPrisma } from "../db/prisma.js";
import { mapProduct } from "../mappers/product.mapper.js";
import { toIsoString } from "../utils/dates.js";
import { findProductImageRowsByProductIds, groupProductImageRowsByProductId } from "./product-images.repository.js";

function mapSection(row) {
  if (!row) {
    return {
      id: "default",
      name: "Featured Products",
      heading: "Shop Featured Products",
      position: 0,
      isActive: true,
      updatedAt: null,
    };
  }

  return {
    id: row.id,
    name: row.name,
    heading: row.heading,
    position: Number(row.position ?? 0),
    isActive: Boolean(row.isActive),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export async function getHomepageProducts(includeHidden = true) {
  const prisma = getPrisma();
  const sectionWhere = includeHidden ? {} : { isActive: true };
  const productWhere = includeHidden ? {} : { isActive: true };

  // Fetch sections ordered by position
  const sections = await prisma.homepageProductSection.findMany({
    where: sectionWhere,
    orderBy: { position: "asc" },
  });

  const results = [];

  for (const sec of sections) {
    const rows = await prisma.homepageProduct.findMany({
      where: {
        sectionId: sec.id,
        ...productWhere,
      },
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

    const items = rows.map((row, index) => ({
      id: row.id,
      sectionId: row.sectionId,
      productId: row.productId,
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
          ratingAvg: row.product?.ratingAvg,
          reviewCount: row.product?.reviewCount,
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

    results.push({
      section: mapSection(sec),
      items,
    });
  }

  return results;
}

export async function replaceHomepageProducts(sectionsPayload) {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const now = new Date();

    // 1. Delete all existing sections (which cascade deletes products)
    await tx.homepageProductSection.deleteMany();

    // 2. Re-create sections and products
    for (const [secIndex, secPayload] of sectionsPayload.entries()) {
      const sectionId = secPayload.section.id || createId("hms");

      await tx.homepageProductSection.create({
        data: {
          id: sectionId,
          name: secPayload.section.name,
          heading: secPayload.section.heading || "",
          position: Number(secPayload.section.position ?? secIndex),
          isActive: secPayload.section.isActive !== false,
          updatedAt: now,
        },
      });

      const records = [];
      for (const [itemIndex, item] of secPayload.items.entries()) {
        records.push({
          id: createId("hmp"),
          sectionId: sectionId,
          productId: item.productId,
          position: Number(item.position ?? itemIndex),
          isActive: item.isActive !== false,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (records.length > 0) {
        await tx.homepageProduct.createMany({
          data: records,
        });
      }
    }
  });

  return getHomepageProducts(true);
}
