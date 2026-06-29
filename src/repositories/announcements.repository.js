import { getPrisma } from "../db/prisma.js";

export async function getAnnouncements(includeHidden = true) {
  const where = includeHidden ? {} : { isActive: true };
  return getPrisma().announcementItem.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function findAnnouncementById(id) {
  const row = await getPrisma().announcementItem.findUnique({
    where: { id },
  });
  return row ?? null;
}

export async function createAnnouncement(input) {
  const now = new Date();
  await getPrisma().announcementItem.create({
    data: {
      id: input.id,
      text: input.text ?? "",
      href: input.href ?? "",
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ? true : false,
      createdAt: now,
      updatedAt: now,
    },
  });

  return findAnnouncementById(input.id);
}

export async function updateAnnouncementById(id, input) {
  const now = new Date();
  try {
    await getPrisma().announcementItem.update({
      where: { id },
      data: {
        text: input.text ?? "",
        href: input.href ?? "",
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

  return findAnnouncementById(id);
}

export async function deleteAnnouncementById(id) {
  try {
    await getPrisma().announcementItem.delete({
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
