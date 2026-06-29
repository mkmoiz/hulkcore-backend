import { getPrisma } from "../db/prisma.js";
import { toIsoString } from "../utils/dates.js";
import { normalizeText } from "../utils/normalize.js";
import { createId } from "../utils.js";

function toRounded(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) {
    return 0;
  }

  return Number(num.toFixed(2));
}

export function deriveComboOfferStatus(input, now = new Date()) {
  const isActive = Boolean(input?.isActive);
  const startDate = input?.startDate ? new Date(input.startDate) : null;
  const endDate = input?.endDate ? new Date(input.endDate) : null;
  const timeNow = now instanceof Date ? now.getTime() : Date.now();
  const startTime = startDate && Number.isFinite(startDate.getTime()) ? startDate.getTime() : null;
  const endTime = endDate && Number.isFinite(endDate.getTime()) ? endDate.getTime() : null;

  if (!isActive) {
    return "draft";
  }
  if (startTime && timeNow < startTime) {
    return "scheduled";
  }
  if (endTime && timeNow > endTime) {
    return "expired";
  }

  return "active";
}

function toComboProduct(row, fallbackPosition = 0) {
  return {
    productId: row.productId,
    position: Number(row.position ?? fallbackPosition),
    name: row.product?.name ?? "",
    imageUrl: row.product?.imageUrl ?? "",
    price: Number(row.product?.offerPrice || row.product?.price || 0),
    originalPrice: Number(row.product?.originalPrice || row.product?.price || 0),
    offerPrice: Number(row.product?.offerPrice || row.product?.price || 0),
    isActive: Boolean(row.product?.isActive),
  };
}

function toComboOffer(row, now = new Date()) {
  if (!row) return null;

  const products = Array.isArray(row.products) ? row.products.map((p, i) => toComboProduct(p, i)) : [];

  const sortedProducts = [...products]
    .sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0))
    .map((entry, index) => ({
      ...entry,
      position: index,
    }));

  const totalOriginalPrice = toRounded(
    sortedProducts.reduce((acc, product) => acc + Number(product.price ?? 0), 0),
  );
  const offerPrice = toRounded(row.offerPrice);
  const saveAmount = toRounded(Math.max(0, totalOriginalPrice - offerPrice));
  const discountPercentage =
    totalOriginalPrice > 0 ? toRounded((saveAmount / totalOriginalPrice) * 100) : 0;
  const startDate = row.startAt ? toIsoString(row.startAt) : null;
  const endDate = row.endAt ? toIsoString(row.endAt) : null;

  // We have to query sales count separately or aggregate it if needed,
  // but for Prisma, we usually don't map it directly unless we include it in the query.
  // The existing repo used a subquery: (SELECT SUM(quantity) FROM order_combo_items WHERE combo_offer_id = co.id)
  // With Prisma we can aggregate it, but since it's a separate model, we do it in the service if needed,
  // or we add it to the row if we fetched it.
  const salesCount = Number(row.salesCount ?? 0);

  return {
    id: row.id,
    title: row.title ?? "",
    bannerImageUrl: row.bannerImageUrl ?? "",
    bannerImageKey: row.bannerImageKey ?? "",
    description: row.description ?? "",
    offerPrice,
    totalOriginalPrice,
    discountPercentage,
    saveAmount,
    position: Number(row.position ?? 0),
    salesCount,
    isActive: Boolean(row.isActive),
    status: deriveComboOfferStatus(
      {
        isActive: Boolean(row.isActive),
        startDate,
        endDate,
      },
      now,
    ),
    startDate,
    endDate,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    products: sortedProducts,
  };
}

export async function getComboOffers(includeHidden = true) {
  const where = includeHidden
    ? {}
    : {
        isActive: true,
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: new Date() } }] },
          { OR: [{ endAt: null }, { endAt: { gte: new Date() } }] },
        ],
      };

  const rows = await getPrisma().comboOffer.findMany({
    where,
    include: {
      products: {
        include: { product: true },
        orderBy: { position: 'asc' },
      },
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
  });

  if (rows.length === 0) {
    return [];
  }

  // Aggregate salesCount
  const offerIds = rows.map((r) => r.id);
  const salesCountGroups = await getPrisma().orderComboItem.groupBy({
    by: ['comboOfferId'],
    where: { comboOfferId: { in: offerIds } },
    _sum: { quantity: true },
  });

  const salesCountMap = salesCountGroups.reduce((acc, group) => {
    acc[group.comboOfferId] = group._sum.quantity ?? 0;
    return acc;
  }, {});

  const now = new Date();
  return rows.map((row, index) =>
    toComboOffer(
      {
        ...row,
        position: Number(row.position ?? index),
        salesCount: salesCountMap[row.id] ?? 0,
      },
      now,
    ),
  );
}

export async function findComboOfferById(id, includeHidden = true) {
  const comboOfferId = normalizeText(id);
  if (!comboOfferId) {
    return null;
  }

  const row = await getPrisma().comboOffer.findUnique({
    where: { id: comboOfferId },
    include: {
      products: {
        include: { product: true },
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!row) {
    return null;
  }

  const salesAggregation = await getPrisma().orderComboItem.aggregate({
    where: { comboOfferId },
    _sum: { quantity: true },
  });

  const offer = toComboOffer(
    {
      ...row,
      salesCount: salesAggregation._sum.quantity ?? 0,
    },
    new Date(),
  );

  if (!includeHidden && offer.status !== "active") {
    return null;
  }

  return offer;
}

function toDbDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date;
}

async function nextComboOfferPosition(prismaClient = getPrisma()) {
  const result = await prismaClient.comboOffer.aggregate({
    _max: { position: true },
  });
  return (result._max.position ?? -1) + 1;
}

export async function createComboOffer(input) {
  const comboOfferId = createId("cbo");
  const now = new Date();
  const startDate = toDbDate(input?.startDate);
  const endDate = toDbDate(input?.endDate);

  await getPrisma().$transaction(async (tx) => {
    const position = await nextComboOfferPosition(tx);

    await tx.comboOffer.create({
      data: {
        id: comboOfferId,
        title: input.title,
        bannerImageUrl: input.bannerImageUrl,
        bannerImageKey: input.bannerImageKey ?? "",
        description: input.description ?? "",
        offerPrice: Number(input.offerPrice ?? 0),
        position,
        isActive: input.isActive ? true : false,
        startAt: startDate,
        endAt: endDate,
        createdAt: now,
        updatedAt: now,
      },
    });

    const comboProducts = input.productIds.map((productId, index) => ({
      id: createId("cbop"),
      comboOfferId,
      productId,
      position: index,
      createdAt: now,
      updatedAt: now,
    }));

    if (comboProducts.length > 0) {
      await tx.comboOfferProduct.createMany({
        data: comboProducts,
      });
    }
  });

  return findComboOfferById(comboOfferId, true);
}

export async function updateComboOfferById(id, input) {
  const comboOfferId = normalizeText(id);
  if (!comboOfferId) {
    return null;
  }

  const now = new Date();
  const startDate = toDbDate(input?.startDate);
  const endDate = toDbDate(input?.endDate);

  try {
    await getPrisma().$transaction(async (tx) => {
      await tx.comboOffer.update({
        where: { id: comboOfferId },
        data: {
          title: input.title,
          bannerImageUrl: input.bannerImageUrl,
          bannerImageKey: input.bannerImageKey ?? "",
          description: input.description ?? "",
          offerPrice: Number(input.offerPrice ?? 0),
          isActive: input.isActive ? true : false,
          startAt: startDate,
          endAt: endDate,
          updatedAt: now,
        },
      });

      await tx.comboOfferProduct.deleteMany({
        where: { comboOfferId },
      });

      const comboProducts = input.productIds.map((productId, index) => ({
        id: createId("cbop"),
        comboOfferId,
        productId,
        position: index,
        createdAt: now,
        updatedAt: now,
      }));

      if (comboProducts.length > 0) {
        await tx.comboOfferProduct.createMany({
          data: comboProducts,
        });
      }
    });
  } catch (error) {
    if (error.code === "P2025") {
      return null;
    }
    throw error;
  }

  return findComboOfferById(comboOfferId, true);
}

export async function deleteComboOfferById(id) {
  const comboOfferId = normalizeText(id);
  if (!comboOfferId) {
    return false;
  }

  try {
    await getPrisma().comboOffer.delete({
      where: { id: comboOfferId },
    });
    return true;
  } catch (error) {
    if (error.code === "P2025") {
      return false;
    }
    throw error;
  }
}

export async function duplicateComboOfferById(id) {
  const existing = await findComboOfferById(id, true);
  if (!existing) {
    return null;
  }

  const nextTitle = `${existing.title} (Copy)`.slice(0, 191);
  return createComboOffer({
    title: nextTitle,
    bannerImageUrl: existing.bannerImageUrl,
    bannerImageKey: existing.bannerImageKey,
    description: existing.description,
    offerPrice: existing.offerPrice,
    isActive: false,
    startDate: null,
    endDate: null,
    productIds: existing.products.map((entry) => entry.productId),
  });
}
