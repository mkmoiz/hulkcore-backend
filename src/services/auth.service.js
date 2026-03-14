import { createId } from "../utils.js";
import { getPool } from "../db/connection.js";
import { mapAuthSession, mapUser } from "../mappers/auth.mapper.js";
import { toIsoString } from "../utils/dates.js";
import { createStoreError } from "../utils/errors.js";
import { normalizeEmail, normalizePhone, normalizeText } from "../utils/normalize.js";
import {
  consumeEmailOtpChallengeById,
  consumeOtpChallengeById,
  deleteAuthSessionByToken as deleteAuthSessionByTokenRow,
  findEmailOtpChallengeRowByIdAndEmail,
  findAuthSessionRowByToken,
  findOtpChallengeRowByIdAndPhone,
  insertEmailOtpChallenge,
  insertAuthSession,
  insertOtpChallenge,
  markOpenEmailOtpChallengesConsumedByEmail,
  markOpenOtpChallengesConsumedByPhone,
  updateEmailOtpAttemptsById,
  updateOtpAttemptsById,
} from "../repositories/auth.repository.js";
import {
  findUserByPhone as findUserByPhoneRepo,
  findUserRowByEmail,
  findUserRowById,
  findUserRowByPhone,
  insertUserVerifiedByEmail,
  insertUserVerified,
  markUserVerified,
  upsertUserProfileById,
} from "../repositories/users.repository.js";

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function findUserByPhone(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return null;
  }

  return findUserByPhoneRepo(normalizedPhone);
}

export async function upsertUserProfile(userId, input) {
  const normalizedUserId = normalizeText(userId);
  if (!normalizedUserId) {
    throw createStoreError("User id is required.", "AUTH_USER_ID_REQUIRED", 400);
  }

  const fullName = normalizeText(input?.fullName);
  const email = normalizeText(input?.email).toLowerCase();
  const addressLine1 = normalizeText(input?.addressLine1);
  const addressLine2 = normalizeText(input?.addressLine2);
  const city = normalizeText(input?.city);
  const state = normalizeText(input?.state);
  const postalCode = normalizeText(input?.postalCode);
  const country = normalizeText(input?.country);

  if (!fullName) {
    throw createStoreError("Full name is required.", "AUTH_PROFILE_NAME_REQUIRED", 400);
  }

  if (!email || !SIMPLE_EMAIL_PATTERN.test(email)) {
    throw createStoreError("Valid email is required.", "AUTH_PROFILE_EMAIL_REQUIRED", 400);
  }

  let updatedRow;
  try {
    updatedRow = await upsertUserProfileById(normalizedUserId, {
      fullName,
      email,
      addressLine1: addressLine1 || null,
      addressLine2: addressLine2 || null,
      city: city || null,
      state: state || null,
      postalCode: postalCode || null,
      country: country || null,
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      throw createStoreError("Email is already linked to another account.", "AUTH_PROFILE_EMAIL_IN_USE", 409);
    }
    throw error;
  }
  const updatedUser = mapUser(updatedRow);
  if (!updatedUser) {
    throw createStoreError("User not found.", "AUTH_USER_NOT_FOUND", 404);
  }

  return updatedUser;
}

export async function createOtpChallenge(input) {
  const phone = normalizePhone(input?.phone);
  const otpHash = normalizeText(input?.otpHash);
  const expiresAt = input?.expiresAt instanceof Date ? input.expiresAt : new Date(input?.expiresAt ?? Date.now());
  const attemptsRemaining =
    Number.isInteger(input?.attemptsRemaining) && Number(input.attemptsRemaining) > 0
      ? Number(input.attemptsRemaining)
      : 5;

  if (!phone) {
    throw createStoreError("Phone number is required.", "AUTH_PHONE_REQUIRED", 400);
  }

  if (!otpHash) {
    throw createStoreError("OTP hash is required.", "AUTH_OTP_HASH_REQUIRED", 400);
  }

  const now = new Date();
  const challengeId = normalizeText(input?.id) || createId("otp");

  await markOpenOtpChallengesConsumedByPhone(phone, now);
  await insertOtpChallenge({
    id: challengeId,
    phone,
    otpHash,
    attemptsRemaining,
    expiresAt,
    now,
  });

  return {
    id: challengeId,
    phone,
    attemptsRemaining,
    expiresAt: toIsoString(expiresAt),
    createdAt: toIsoString(now),
  };
}

export async function createEmailOtpChallenge(input) {
  const email = normalizeEmail(input?.email);
  const otpHash = normalizeText(input?.otpHash);
  const expiresAt = input?.expiresAt instanceof Date ? input.expiresAt : new Date(input?.expiresAt ?? Date.now());
  const attemptsRemaining =
    Number.isInteger(input?.attemptsRemaining) && Number(input.attemptsRemaining) > 0
      ? Number(input.attemptsRemaining)
      : 5;

  if (!email) {
    throw createStoreError("Email is required.", "AUTH_EMAIL_REQUIRED", 400);
  }

  if (!otpHash) {
    throw createStoreError("OTP hash is required.", "AUTH_OTP_HASH_REQUIRED", 400);
  }

  const now = new Date();
  const challengeId = normalizeText(input?.id) || createId("eotp");

  await markOpenEmailOtpChallengesConsumedByEmail(email, now);
  await insertEmailOtpChallenge({
    id: challengeId,
    email,
    otpHash,
    attemptsRemaining,
    expiresAt,
    now,
  });

  return {
    id: challengeId,
    email,
    attemptsRemaining,
    expiresAt: toIsoString(expiresAt),
    createdAt: toIsoString(now),
  };
}

export async function verifyOtpChallengeAndCreateSession(input) {
  const phone = normalizePhone(input?.phone);
  const challengeId = normalizeText(input?.challengeId);
  const otpHash = normalizeText(input?.otpHash);
  const ttlMs = Number(input?.sessionTtlMs);
  const sessionTtlMs = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 1000 * 60 * 60 * 24 * 30;

  if (!phone) {
    throw createStoreError("Phone number is required.", "AUTH_PHONE_REQUIRED", 400);
  }

  if (!challengeId) {
    throw createStoreError("OTP challenge id is required.", "AUTH_OTP_CHALLENGE_REQUIRED", 400);
  }

  if (!otpHash) {
    throw createStoreError("OTP hash is required.", "AUTH_OTP_HASH_REQUIRED", 400);
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const otpChallenge = await findOtpChallengeRowByIdAndPhone(challengeId, phone, connection, true);
    if (!otpChallenge) {
      throw createStoreError("OTP challenge not found.", "AUTH_OTP_CHALLENGE_NOT_FOUND", 404);
    }

    if (otpChallenge.consumedAt) {
      throw createStoreError("OTP challenge has already been used.", "AUTH_OTP_ALREADY_USED", 409);
    }

    const now = new Date();
    const expiresAtMs = new Date(otpChallenge.expiresAt).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < now.getTime()) {
      await consumeOtpChallengeById(challengeId, now, connection);
      throw createStoreError("OTP has expired. Please request a new one.", "AUTH_OTP_EXPIRED", 401);
    }

    const attemptsRemaining = Number(otpChallenge.attemptsRemaining ?? 0);
    if (!Number.isInteger(attemptsRemaining) || attemptsRemaining <= 0) {
      throw createStoreError("OTP max attempts exceeded. Request a new OTP.", "AUTH_OTP_ATTEMPTS_EXCEEDED", 429);
    }

    if (otpChallenge.otpHash !== otpHash) {
      const nextAttempts = Math.max(0, attemptsRemaining - 1);
      await updateOtpAttemptsById(challengeId, nextAttempts, now, connection);
      throw createStoreError("Invalid OTP.", "AUTH_OTP_INVALID", 401);
    }

    await consumeOtpChallengeById(challengeId, now, connection);

    let userRow = await findUserRowByPhone(phone, connection);
    if (!userRow) {
      const userId = createId("usr");
      await insertUserVerified(userId, phone, now, connection);
      userRow = await findUserRowById(userId, connection);
    } else if (!Boolean(userRow.isVerified)) {
      await markUserVerified(userRow.id, now, connection);
      userRow = await findUserRowById(userRow.id, connection);
    }

    const token = createId("auth");
    const sessionExpiresAt = new Date(now.getTime() + sessionTtlMs);
    await insertAuthSession(
      {
        token,
        userId: userRow.id,
        expiresAt: sessionExpiresAt,
        now,
      },
      connection,
    );

    await connection.commit();

    const createdSession = await findAuthSessionRowByToken(token);
    return mapAuthSession(createdSession);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function verifyEmailOtpChallengeAndCreateSession(input) {
  const email = normalizeEmail(input?.email);
  const challengeId = normalizeText(input?.challengeId);
  const otpHash = normalizeText(input?.otpHash);
  const ttlMs = Number(input?.sessionTtlMs);
  const sessionTtlMs = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 1000 * 60 * 60 * 24 * 30;

  if (!email) {
    throw createStoreError("Email is required.", "AUTH_EMAIL_REQUIRED", 400);
  }

  if (!challengeId) {
    throw createStoreError("OTP challenge id is required.", "AUTH_OTP_CHALLENGE_REQUIRED", 400);
  }

  if (!otpHash) {
    throw createStoreError("OTP hash is required.", "AUTH_OTP_HASH_REQUIRED", 400);
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const otpChallenge = await findEmailOtpChallengeRowByIdAndEmail(challengeId, email, connection, true);
    if (!otpChallenge) {
      throw createStoreError("OTP challenge not found.", "AUTH_OTP_CHALLENGE_NOT_FOUND", 404);
    }

    if (otpChallenge.consumedAt) {
      throw createStoreError("OTP challenge has already been used.", "AUTH_OTP_ALREADY_USED", 409);
    }

    const now = new Date();
    const expiresAtMs = new Date(otpChallenge.expiresAt).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < now.getTime()) {
      await consumeEmailOtpChallengeById(challengeId, now, connection);
      throw createStoreError("OTP has expired. Please request a new one.", "AUTH_OTP_EXPIRED", 401);
    }

    const attemptsRemaining = Number(otpChallenge.attemptsRemaining ?? 0);
    if (!Number.isInteger(attemptsRemaining) || attemptsRemaining <= 0) {
      throw createStoreError("OTP max attempts exceeded. Request a new OTP.", "AUTH_OTP_ATTEMPTS_EXCEEDED", 429);
    }

    if (otpChallenge.otpHash !== otpHash) {
      const nextAttempts = Math.max(0, attemptsRemaining - 1);
      await updateEmailOtpAttemptsById(challengeId, nextAttempts, now, connection);
      throw createStoreError("Invalid OTP.", "AUTH_OTP_INVALID", 401);
    }

    await consumeEmailOtpChallengeById(challengeId, now, connection);

    let userRow = await findUserRowByEmail(email, connection);
    if (!userRow) {
      const userId = createId("usr");
      await insertUserVerifiedByEmail(userId, email, now, connection);
      userRow = await findUserRowById(userId, connection);
    } else if (!Boolean(userRow.isVerified)) {
      await markUserVerified(userRow.id, now, connection);
      userRow = await findUserRowById(userRow.id, connection);
    }

    const token = createId("auth");
    const sessionExpiresAt = new Date(now.getTime() + sessionTtlMs);
    await insertAuthSession(
      {
        token,
        userId: userRow.id,
        expiresAt: sessionExpiresAt,
        now,
      },
      connection,
    );

    await connection.commit();

    const createdSession = await findAuthSessionRowByToken(token);
    return mapAuthSession(createdSession);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function findAuthSessionByToken(token) {
  const normalizedToken = normalizeText(token);
  if (!normalizedToken) {
    return null;
  }

  const row = await findAuthSessionRowByToken(normalizedToken);
  const session = mapAuthSession(row);
  if (!session) {
    return null;
  }

  const expiresAtMs = new Date(session.expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    await deleteAuthSessionByToken(normalizedToken);
    return null;
  }

  return session;
}

export async function deleteAuthSessionByToken(token) {
  const normalizedToken = normalizeText(token);
  if (!normalizedToken) {
    return false;
  }

  return deleteAuthSessionByTokenRow(normalizedToken);
}
