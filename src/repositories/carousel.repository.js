import { getPrisma } from "../db/prisma.js";
import { mapCarouselImage } from "../mappers/product.mapper.js";

export async function getCarouselImages(includeHidden = true) {
  const where = includeHidden ? {} : { isActive: true };
  const rows = await getPrisma().carouselImage.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return rows.map(mapCarouselImage);
}

export async function findCarouselImageById(id) {
  const row = await getPrisma().carouselImage.findUnique({
    where: { id },
  });

  return mapCarouselImage(row);
}

export async function createCarouselImage(input) {
  const now = new Date();
  await getPrisma().carouselImage.create({
    data: {
      id: input.id,
      title: input.title ?? "",
      imageUrl: input.imageUrl,
      imageKey: input.imageKey ?? "",
      linkedProductId: input.linkedProductId || null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ? true : false,
      createdAt: now,
      updatedAt: now,
    },
  });

  return findCarouselImageById(input.id);
}

export async function updateCarouselImageById(id, input) {
  const now = new Date();
  try {
    await getPrisma().carouselImage.update({
      where: { id },
      data: {
        title: input.title ?? "",
        imageUrl: input.imageUrl,
        imageKey: input.imageKey ?? "",
        linkedProductId: input.linkedProductId || null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ? true : false,
        updatedAt: now,
      },
    });
  } catch (error) {
    if (error.code === "P2025") {
      return null;
    }
    throw error;
  }

  return findCarouselImageById(id);
}

export async function deleteCarouselImageById(id) {
  try {
    await getPrisma().carouselImage.delete({
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
