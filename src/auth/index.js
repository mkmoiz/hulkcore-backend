import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { sendMail } from "../services/mailService.js";
import { buildOtpEmailHtml, buildOtpEmailText } from "../services/emailTemplates.js";
import { isEmailSuppressed } from "../repositories/email-suppressions.repository.js";
import {
  ADMIN_API_TOKEN,
  ADMIN_AUTH_COOKIE_NAME,
  ADMIN_LOGIN_EMAIL,
  ADMIN_LOGIN_NAME,
  ADMIN_ROLE_HEADER,
  ADMIN_ROLE_VALUE,
  ADMIN_SESSION_TTL_SEC,
  ADMIN_TOKEN_HEADER,
  COOKIE_SAME_SITE,
  COOKIE_SECURE,
  OTP_HASH_SECRET,
  USER_AUTH_COOKIE_NAME,
} from "../config/environment.js";
import { createErrorBody, createHttpError } from "../errors/index.js";
import { deleteCacheKey, getCacheJson, setCacheJson } from "../redisCache.js";
import { findAuthSessionByToken } from "../store.js";
import { cleanText } from "../utils.js";

export async function sendOtpWithZeptoMail(emailAddress, otpCode) {
  const normalizedEmail = cleanText(emailAddress).toLowerCase();
  if (!normalizedEmail) {
    throw createHttpError(400, "Valid email is required for ZeptoMail delivery.");
  }

  // Check if email is suppressed due to previous bounce/complaint
  const suppressed = await isEmailSuppressed(normalizedEmail);
  if (suppressed) {
    console.warn(`[mail] OTP send blocked — email="${normalizedEmail}" is suppressed (bounced/complained)`);
    throw createHttpError(422, "We couldn't deliver to this email address. It may be invalid or has previously bounced. Please try a different email.");
  }

  try {
    const result = await sendMail({
      to: normalizedEmail,
      subject: "Your Hulk Core login OTP",
      html: buildOtpEmailHtml(otpCode),
      text: buildOtpEmailText(otpCode),
    });

    return { provider: result.provider, sent: true };
  } catch (error) {
    throw createHttpError(502, "Failed to deliver OTP email via ZeptoMail SMTP: " + error.message);
  }
}

// ─── Admin Password Hashing (scrypt) ─────────────────────────────

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_HASH_PATTERN = /^[a-f0-9]{32}:[a-f0-9]{128}$/;

/**
 * Hash a plaintext password using scrypt.
 * Returns a string in the format "salt:hash" (hex-encoded).
 */
export function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(password, salt, SCRYPT_KEY_LENGTH, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

/**
 * Verify a plaintext password against a stored "salt:hash" string.
 * Uses timingSafeEqual for constant-time comparison.
 */
export function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return resolve(false);
    scrypt(password, salt, SCRYPT_KEY_LENGTH, (err, derivedKey) => {
      if (err) return reject(err);
      const storedBuffer = Buffer.from(hash, "hex");
      if (storedBuffer.length !== derivedKey.length) return resolve(false);
      resolve(timingSafeEqual(storedBuffer, derivedKey));
    });
  });
}

/**
 * Check if a string looks like a scrypt hash (salt:hash format).
 */
export function isScryptHash(value) {
  return SCRYPT_HASH_PATTERN.test(cleanText(value));
}

export const ADMIN_SESSION_MEMORY_CACHE = new Map();

export function parseCookieHeader(rawCookieHeader) {
  const raw = cleanText(rawCookieHeader);
  if (!raw) {
    return {};
  }

  const parsed = {};
  for (const entry of raw.split(";")) {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    try {
      parsed[key] = decodeURIComponent(value);
    } catch {
      parsed[key] = value;
    }
  }

  return parsed;
}

export function readCookieValue(req, name) {
  const normalizedName = cleanText(name);
  if (!normalizedName) {
    return "";
  }

  const cookies = parseCookieHeader(req.get("cookie"));
  return cleanText(cookies[normalizedName]);
}

export function buildCookieHeader(name, value, options = {}) {
  const normalizedName = cleanText(name);
  if (!normalizedName) {
    return "";
  }

  const encodedValue = encodeURIComponent(cleanText(value));
  const segments = [`${normalizedName}=${encodedValue}`];
  const path = cleanText(options.path) || "/";
  segments.push(`Path=${path}`);

  if (options.httpOnly !== false) {
    segments.push("HttpOnly");
  }
  if (options.secure) {
    segments.push("Secure");
  }
  if (cleanText(options.sameSite)) {
    segments.push(`SameSite=${options.sameSite}`);
  }
  if (Number.isInteger(options.maxAge) && options.maxAge >= 0) {
    segments.push(`Max-Age=${options.maxAge}`);
  }
  if (options.expires instanceof Date) {
    segments.push(`Expires=${options.expires.toUTCString()}`);
  }

  return segments.join("; ");
}

export function setCookie(res, name, value, options = {}) {
  const cookieHeader = buildCookieHeader(name, value, options);
  if (!cookieHeader) {
    return;
  }

  res.append("Set-Cookie", cookieHeader);
}

export function clearCookie(res, name) {
  setCookie(res, name, "", {
    maxAge: 0,
    expires: new Date(0),
    path: "/",
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE,
  });
}

export function createAdminSessionPayload(sessionId) {
  const now = new Date();
  return {
    id: cleanText(sessionId),
    email: ADMIN_LOGIN_EMAIL,
    name: ADMIN_LOGIN_NAME,
    role: ADMIN_ROLE_VALUE,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ADMIN_SESSION_TTL_SEC * 1000).toISOString(),
  };
}

export function readAdminSessionFromMemory(sessionId) {
  const record = ADMIN_SESSION_MEMORY_CACHE.get(sessionId);
  if (!record) {
    return null;
  }

  const expiresAtMs = new Date(record.expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    ADMIN_SESSION_MEMORY_CACHE.delete(sessionId);
    return null;
  }

  return record;
}

export async function persistAdminSession(session) {
  const sessionId = cleanText(session?.id);
  if (!sessionId) {
    return;
  }

  ADMIN_SESSION_MEMORY_CACHE.set(sessionId, session);
  await setCacheJson(`admin:session:${sessionId}`, session, ADMIN_SESSION_TTL_SEC);
}

export async function readAdminSession(sessionId) {
  const normalizedSessionId = cleanText(sessionId);
  if (!normalizedSessionId) {
    return null;
  }

  const cached = await getCacheJson(`admin:session:${normalizedSessionId}`);
  if (cached && typeof cached === "object") {
    return cached;
  }

  return readAdminSessionFromMemory(normalizedSessionId);
}

export async function deleteAdminSession(sessionId) {
  const normalizedSessionId = cleanText(sessionId);
  if (!normalizedSessionId) {
    return;
  }

  ADMIN_SESSION_MEMORY_CACHE.delete(normalizedSessionId);
  await deleteCacheKey(`admin:session:${normalizedSessionId}`);
}

export async function resolveAdminSession(req) {
  const sessionId = readCookieValue(req, ADMIN_AUTH_COOKIE_NAME);
  if (!sessionId) {
    return null;
  }

  return readAdminSession(sessionId);
}

export function readAdminToken(req) {
  const headerToken = cleanText(req.get(ADMIN_TOKEN_HEADER));
  if (headerToken) {
    return headerToken;
  }

  const authorizationHeader = cleanText(req.get("authorization"));
  if (authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return cleanText(authorizationHeader.slice(7));
  }

  return "";
}

export async function requireAdminAccess(req, res, next) {
  try {
    const adminSession = await resolveAdminSession(req);
    if (adminSession?.role === ADMIN_ROLE_VALUE) {
      req.adminSession = adminSession;
      return next();
    }

    const role = cleanText(req.get(ADMIN_ROLE_HEADER)).toLowerCase();
    if (role && role !== ADMIN_ROLE_VALUE) {
      return res.status(401).json(createErrorBody("ADMIN_AUTH_REQUIRED", "Admin authentication required."));
    }

    const providedToken = readAdminToken(req);
    if (!ADMIN_API_TOKEN || !providedToken || providedToken !== ADMIN_API_TOKEN) {
      return res.status(401).json(createErrorBody("ADMIN_AUTH_REQUIRED", "Admin authentication required."));
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

export function generateOtpCode() {
  return String(randomInt(100000, 1000000));
}

export function hashOtpCode({ phone, email, identifier, challengeId, otpCode }) {
  const otpIdentity = cleanText(identifier || email || phone).toLowerCase();
  return createHash("sha256")
    .update(`${otpIdentity}|${challengeId}|${otpCode}|${OTP_HASH_SECRET}`)
    .digest("hex");
}

export function extractAuthToken(req) {
  const authorizationHeader = cleanText(req.get("authorization"));
  if (authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return cleanText(authorizationHeader.slice(7));
  }

  const headerToken = cleanText(req.get("x-auth-token"));
  if (headerToken) {
    return headerToken;
  }

  return readCookieValue(req, USER_AUTH_COOKIE_NAME);
}

export async function requireAuthenticatedSession(req, res) {
  const authToken = extractAuthToken(req);
  if (!authToken) {
    res.status(401).json({ message: "Login required before checkout." });
    return null;
  }

  const session = await findAuthSessionByToken(authToken);
  if (!session?.user || !session.user.isVerified) {
    res.status(401).json({ message: "Session expired or invalid. Please login again." });
    return null;
  }

  return session;
}


