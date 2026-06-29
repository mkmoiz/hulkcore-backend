import { getPrisma } from "../db/prisma.js";

export async function markOpenOtpChallengesConsumedByPhone(phone, now) {
  await getPrisma().otpChallenge.updateMany({
    where: { phone, consumedAt: null },
    data: { consumedAt: now, updatedAt: now },
  });
}

export async function markOpenEmailOtpChallengesConsumedByEmail(email, now) {
  await getPrisma().emailOtpChallenge.updateMany({
    where: { email, consumedAt: null },
    data: { consumedAt: now, updatedAt: now },
  });
}

export async function insertOtpChallenge(entry) {
  await getPrisma().otpChallenge.create({
    data: {
      id: entry.id,
      phone: entry.phone,
      otpHash: entry.otpHash,
      attemptsRemaining: entry.attemptsRemaining,
      expiresAt: entry.expiresAt,
      consumedAt: null,
      createdAt: entry.now,
      updatedAt: entry.now,
    },
  });
}

export async function insertEmailOtpChallenge(entry) {
  await getPrisma().emailOtpChallenge.create({
    data: {
      id: entry.id,
      email: entry.email,
      otpHash: entry.otpHash,
      attemptsRemaining: entry.attemptsRemaining,
      expiresAt: entry.expiresAt,
      consumedAt: null,
      createdAt: entry.now,
      updatedAt: entry.now,
    },
  });
}

export async function findOtpChallengeRowByIdAndPhone(challengeId, phone, prismaClient = getPrisma(), forUpdate = false) {
  // Prisma does not support SELECT ... FOR UPDATE natively on findFirst,
  // so for transactional locking we rely on the interactive transaction isolation
  const row = await prismaClient.otpChallenge.findFirst({
    where: { id: challengeId, phone },
  });

  return row ?? null;
}

export async function findEmailOtpChallengeRowByIdAndEmail(challengeId, email, prismaClient = getPrisma(), forUpdate = false) {
  const row = await prismaClient.emailOtpChallenge.findFirst({
    where: { id: challengeId, email },
  });

  return row ?? null;
}

export async function consumeOtpChallengeById(challengeId, now, prismaClient = getPrisma()) {
  await prismaClient.otpChallenge.update({
    where: { id: challengeId },
    data: { consumedAt: now, updatedAt: now },
  });
}

export async function consumeEmailOtpChallengeById(challengeId, now, prismaClient = getPrisma()) {
  await prismaClient.emailOtpChallenge.update({
    where: { id: challengeId },
    data: { consumedAt: now, updatedAt: now },
  });
}

export async function updateOtpAttemptsById(challengeId, attemptsRemaining, now, prismaClient = getPrisma()) {
  await prismaClient.otpChallenge.update({
    where: { id: challengeId },
    data: { attemptsRemaining, updatedAt: now },
  });
}

export async function updateEmailOtpAttemptsById(challengeId, attemptsRemaining, now, prismaClient = getPrisma()) {
  await prismaClient.emailOtpChallenge.update({
    where: { id: challengeId },
    data: { attemptsRemaining, updatedAt: now },
  });
}

export async function insertAuthSession(entry, prismaClient = getPrisma()) {
  await prismaClient.authSession.create({
    data: {
      token: entry.token,
      userId: entry.userId,
      expiresAt: entry.expiresAt,
      createdAt: entry.now,
      updatedAt: entry.now,
    },
  });
}

export async function findAuthSessionRowByToken(token, prismaClient = getPrisma()) {
  const row = await prismaClient.authSession.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!row) {
    return null;
  }

  // Map to the flat structure expected by mapAuthSession
  return {
    token: row.token,
    userId: row.userId,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    userPhone: row.user?.phone || "",
    userFullName: row.user?.fullName || "",
    userEmail: row.user?.email || "",
    userAddressLine1: row.user?.addressLine1 || "",
    userAddressLine2: row.user?.addressLine2 || "",
    userCity: row.user?.city || "",
    userState: row.user?.state || "",
    userPostalCode: row.user?.postalCode || "",
    userCountry: row.user?.country || "",
    userIsVerified: row.user?.isVerified,
    userCreatedAt: row.user?.createdAt,
    userUpdatedAt: row.user?.updatedAt,
  };
}

export async function deleteAuthSessionByToken(token) {
  try {
    await getPrisma().authSession.delete({
      where: { token },
    });
    return true;
  } catch (error) {
    if (error.code === "P2025") {
      return false;
    }
    throw error;
  }
}
