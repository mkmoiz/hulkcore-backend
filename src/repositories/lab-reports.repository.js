import { getPrisma } from "../db/prisma.js";
import { mapLabReport } from "../mappers/level.mapper.js";

export async function getLabReports(includeHidden = true) {
  const where = includeHidden ? {} : { isActive: true };
  const rows = await getPrisma().labReport.findMany({
    where,
    include: { product: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  return rows.map((row) =>
    mapLabReport({
      ...row,
      productIdRef: row.product?.id,
      productName: row.product?.name,
      productImageUrl: row.product?.imageUrl,
      productSku: row.product?.sku,
    }),
  );
}

export async function findLabReportById(id) {
  const row = await getPrisma().labReport.findUnique({
    where: { id },
    include: { product: true },
  });

  if (!row) {
    return null;
  }

  return mapLabReport({
    ...row,
    productIdRef: row.product?.id,
    productName: row.product?.name,
    productImageUrl: row.product?.imageUrl,
    productSku: row.product?.sku,
  });
}

export async function createLabReport(input) {
  const now = new Date();
  await getPrisma().labReport.create({
    data: {
      id: input.id,
      title: input.title,
      description: input.description ?? "",
      reportUrl: input.reportUrl ?? "",
      reportKey: input.reportKey ?? "",
      productId: input.productId || null,
      isActive: input.isActive ? true : false,
      position: input.position ?? 0,
      createdAt: now,
      updatedAt: now,
    },
  });

  return findLabReportById(input.id);
}

export async function updateLabReportById(id, input) {
  const now = new Date();
  try {
    await getPrisma().labReport.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description ?? "",
        reportUrl: input.reportUrl ?? "",
        reportKey: input.reportKey ?? "",
        productId: input.productId || null,
        isActive: input.isActive ? true : false,
        position: input.position ?? 0,
        updatedAt: now,
      },
    });
  } catch (error) {
    if (error.code === "P2025") {
      return null;
    }
    throw error;
  }

  return findLabReportById(id);
}

export async function deleteLabReportById(id) {
  try {
    await getPrisma().labReport.delete({
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
