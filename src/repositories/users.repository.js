import { getPrisma } from "../db/prisma.js";
import { mapUser } from "../mappers/auth.mapper.js";

export async function findUserRowByPhone(phone, prismaClient = getPrisma()) {
  const row = await prismaClient.user.findFirst({
    where: { phone },
  });

  return row ?? null;
}

export async function findUserRowByEmail(email, prismaClient = getPrisma()) {
  const row = await prismaClient.user.findFirst({
    where: { email },
  });

  return row ?? null;
}

export async function findUserRowById(userId, prismaClient = getPrisma()) {
  const row = await prismaClient.user.findUnique({
    where: { id: userId },
  });

  return row ?? null;
}

export async function findUserByPhone(phone) {
  const userRow = await findUserRowByPhone(phone);
  return mapUser(userRow);
}

export async function insertUserVerified(userId, phone, now, prismaClient = getPrisma()) {
  await prismaClient.user.create({
    data: {
      id: userId,
      phone,
      isVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  });
}

export async function insertUserVerifiedByEmail(userId, email, now, prismaClient = getPrisma()) {
  await prismaClient.user.create({
    data: {
      id: userId,
      phone: null,
      fullName: "",
      email,
      addressLine1: null,
      addressLine2: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
      isVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  });
}

export async function markUserVerified(userId, now, prismaClient = getPrisma()) {
  await prismaClient.user.update({
    where: { id: userId },
    data: { isVerified: true, updatedAt: now },
  });
}

export async function upsertUserProfileById(userId, profile, now = new Date(), prismaClient = getPrisma()) {
  await prismaClient.user.update({
    where: { id: userId },
    data: {
      fullName: profile.fullName,
      email: profile.email,
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2,
      city: profile.city,
      state: profile.state,
      postalCode: profile.postalCode,
      country: profile.country,
      updatedAt: now,
    },
  });

  return findUserRowById(userId, prismaClient);
}

export async function getUsersForAdmin({ limit = 50, offset = 0, searchQuery = "" } = {}, prismaClient = getPrisma()) {
  const where = {};
  if (searchQuery) {
    where.OR = [
      { fullName: { contains: searchQuery } },
      { email: { contains: searchQuery } },
      { phone: { contains: searchQuery } },
      { id: { contains: searchQuery } },
    ];
  }

  const [users, total] = await Promise.all([
    prismaClient.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        phone: true,
        fullName: true,
        email: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prismaClient.user.count({ where }),
  ]);

  return { users, total };
}
