import { createId } from "../utils.js";
import { getPrisma } from "../db/prisma.js";
import { mapLevel, mapLevelProduct } from "../mappers/level.mapper.js";
import { mapProduct } from "../mappers/product.mapper.js";
import { normalizeIdArray, normalizeText } from "../utils/normalize.js";
import { findProductImageRowsByProductIds, groupProductImageRowsByProductId } from "./product-images.repository.js";

async function findLevelProductRowsByLevelIds(levelIds, prismaClient = getPrisma()) {
  if (!Array.isArray(levelIds) || levelIds.length === 0) {
    return [];
  }

  const rows = await prismaClient.levelProduct.findMany({
    where: { levelId: { in: levelIds } },
    include: {
      product: {
        include: { category: true },
      },
    },
    orderBy: [{ levelId: "asc" }, { isPinned: "desc" }, { position: "asc" }, { createdAt: "asc" }],
  });

  // Map to the flat structure the existing code expects
  return rows.map((row) => ({
    id: row.id,
    levelId: row.levelId,
    productId: row.productId,
    position: row.position,
    isPinned: row.isPinned,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    productIdRef: row.product?.id,
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
    productIsActive: row.product?.isActive,
    productCreatedAt: row.product?.createdAt,
    productUpdatedAt: row.product?.updatedAt,
    categoryIdRef: row.product?.category?.id,
    categoryName: row.product?.category?.name,
    categorySlug: row.product?.category?.slug,
  }));
}

function toMappedProductFromJoinedRow(row, imagesByProductId) {
  return mapProduct(
    {
      id: row.productIdRef,
      name: row.name,
      description: row.description,
      imageUrl: row.imageUrl,
      imageKey: row.imageKey,
      sku: row.sku,
      badge: row.badge,
      subtitle: row.subtitle,
      categoryId: row.categoryId,
      price: row.price,
      originalPrice: row.originalPrice,
      offerPrice: row.offerPrice,
      stock: row.stock,
      isActive: row.productIsActive,
      createdAt: row.productCreatedAt,
      updatedAt: row.productUpdatedAt,
      categoryIdRef: row.categoryIdRef,
      categoryName: row.categoryName,
      categorySlug: row.categorySlug,
    },
    imagesByProductId[row.productIdRef] ?? [],
  );
}

async function attachLevelProducts(levels, prismaClient = getPrisma()) {
  if (!Array.isArray(levels) || levels.length === 0) {
    return [];
  }

  const levelIds = levels.map((level) => level.id);
  const levelProductRows = await findLevelProductRowsByLevelIds(levelIds, prismaClient);
  const productIds = Array.from(new Set(levelProductRows.map((row) => row.productIdRef).filter(Boolean)));
  const imageRows = await findProductImageRowsByProductIds(productIds, prismaClient);
  const imagesByProductId = groupProductImageRowsByProductId(imageRows);

  const assignmentsByLevelId = levelProductRows.reduce((acc, row) => {
    const product = toMappedProductFromJoinedRow(row, imagesByProductId);
    const mappedAssignment = mapLevelProduct(row, product);
    if (!mappedAssignment) {
      return acc;
    }

    if (!acc[mappedAssignment.levelId]) {
      acc[mappedAssignment.levelId] = [];
    }
    acc[mappedAssignment.levelId].push(mappedAssignment);
    return acc;
  }, {});

  return levels.map((level) => ({
    ...level,
    levelProducts: (assignmentsByLevelId[level.id] ?? [])
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1;
        }
        if (a.position !== b.position) {
          return a.position - b.position;
        }
        return a.createdAt.localeCompare(b.createdAt);
      })
      .map((entry, index) => ({
        ...entry,
        position: index,
      })),
  }));
}

export async function getLevels(includeHidden = true) {
  const where = includeHidden ? {} : { isActive: true };
  const rows = await getPrisma().level.findMany({
    where,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  const mappedLevels = rows.map(mapLevel).filter(Boolean);
  return attachLevelProducts(mappedLevels);
}

export async function findLevelById(id) {
  const row = await getPrisma().level.findUnique({
    where: { id },
  });
  const level = mapLevel(row);
  if (!level) {
    return null;
  }

  const [withProducts] = await Promise.all([attachLevelProducts([level])]);
  return withProducts ?? null;
}

export async function findLevelBySlug(slug, includeHidden = true) {
  const where = includeHidden ? { slug } : { slug, isActive: true };
  const row = await getPrisma().level.findFirst({
    where,
  });
  const level = mapLevel(row);
  if (!level) {
    return null;
  }

  const [withProducts] = await Promise.all([attachLevelProducts([level])]);
  return withProducts ?? null;
}

export async function findLevelByName(name, excludeId) {
  const where = {
    name: { equals: name, mode: "insensitive" },
  };
  if (excludeId) {
    where.id = { not: excludeId };
  }

  const row = await getPrisma().level.findFirst({ where });
  return mapLevel(row);
}

export async function createLevel(input) {
  const now = new Date();
  const includeCategoryIds = Array.from(new Set(normalizeIdArray(input?.includeCategoryIds)));
  await getPrisma().level.create({
    data: {
      id: input.id,
      slug: input.slug,
      name: input.name,
      description: input.description ?? "",
      imageUrl: input.imageUrl ?? "",
      imageKey: input.imageKey ?? "",
      position: input.position ?? 0,
      isActive: input.isActive ? true : false,
      ruleMode: input.ruleMode === "DYNAMIC" ? "DYNAMIC" : "CURATED",
      sortMode: input.sortMode ?? "featured",
      includeCategoryIdsJson: JSON.stringify(includeCategoryIds),
      createdAt: now,
      updatedAt: now,
    },
  });

  return findLevelById(input.id);
}

export async function updateLevelById(id, input) {
  const now = new Date();
  const includeCategoryIds = Array.from(new Set(normalizeIdArray(input?.includeCategoryIds)));

  try {
    await getPrisma().level.update({
      where: { id },
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description ?? "",
        imageUrl: input.imageUrl ?? "",
        imageKey: input.imageKey ?? "",
        position: input.position ?? 0,
        isActive: input.isActive ? true : false,
        ruleMode: input.ruleMode === "DYNAMIC" ? "DYNAMIC" : "CURATED",
        sortMode: input.sortMode ?? "featured",
        includeCategoryIdsJson: JSON.stringify(includeCategoryIds),
        updatedAt: now,
      },
    });
  } catch (error) {
    if (error.code === "P2025") {
      return null;
    }
    throw error;
  }

  return findLevelById(id);
}

export async function deleteLevelById(id) {
  try {
    await getPrisma().level.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    if (error.code === "P2025") {
      return false;
    }
    throw error;
  }
}

export async function replaceLevelProductAssignments(levelId, entries) {
  const normalizedLevelId = normalizeText(levelId);
  if (!normalizedLevelId) {
    throw new Error("Level id is required.");
  }

  const normalizedEntries = Array.isArray(entries) ? entries : [];

  await getPrisma().$transaction(async (tx) => {
    await tx.levelProduct.deleteMany({
      where: { levelId: normalizedLevelId },
    });

    const now = new Date();
    const records = [];
    for (const [index, entry] of normalizedEntries.entries()) {
      const productId = normalizeText(entry?.productId);
      if (!productId) {
        continue;
      }

      const positionCandidate = Number(entry?.position);
      const position =
        Number.isInteger(positionCandidate) && positionCandidate >= 0
          ? positionCandidate
          : index;

      records.push({
        id: createId("lvp"),
        levelId: normalizedLevelId,
        productId,
        position,
        isPinned: entry?.isPinned ? true : false,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (records.length > 0) {
      await tx.levelProduct.createMany({
        data: records,
      });
    }
  });

  return findLevelById(normalizedLevelId);
}
