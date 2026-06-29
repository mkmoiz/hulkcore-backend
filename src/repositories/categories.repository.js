import { getPrisma } from "../db/prisma.js";
import { mapCategory } from "../mappers/category.mapper.js";

export async function getCategories() {
  const rows = await getPrisma().category.findMany({
    orderBy: { createdAt: "desc" },
  });

  return rows.map(mapCategory);
}

export async function findCategoryById(id) {
  const row = await getPrisma().category.findUnique({
    where: { id },
  });

  return mapCategory(row);
}

export async function findCategoryByName(name, excludeId) {
  const where = {
    name: { equals: name, mode: "insensitive" },
  };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  const row = await getPrisma().category.findFirst({
    where,
  });

  return mapCategory(row);
}

export async function createCategory(input) {
  const now = new Date();
  await getPrisma().category.create({
    data: {
      id: input.id,
      name: input.name,
      slug: input.slug,
      description: input.description,
      imageUrl: input.imageUrl ?? "",
      imageKey: input.imageKey ?? "",
      createdAt: now,
      updatedAt: now,
    },
  });

  return findCategoryById(input.id);
}

export async function updateCategoryById(id, input) {
  const now = new Date();
  try {
    await getPrisma().category.update({
      where: { id },
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        imageUrl: input.imageUrl ?? "",
        imageKey: input.imageKey ?? "",
        updatedAt: now,
      },
    });
  } catch (error) {
    if (error.code === "P2025") {
      return null;
    }
    throw error;
  }

  return findCategoryById(id);
}

export async function countProductsByCategoryId(categoryId) {
  return getPrisma().product.count({
    where: { categoryId },
  });
}

export async function deleteCategoryById(id) {
  try {
    await getPrisma().category.delete({
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

export async function categoryExists(id) {
  const count = await getPrisma().category.count({
    where: { id },
  });

  return count > 0;
}
