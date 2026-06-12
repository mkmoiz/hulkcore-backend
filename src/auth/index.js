import { createHash, randomInt } from "node:crypto";
import nodemailer from "nodemailer";
import { MailtrapTransport } from "mailtrap";
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

export async function sendOtpWithMsg91(phoneNumber, otpCode) {
  const authKey = cleanText(process.env.MSG91_AUTH_KEY);
  const templateId = cleanText(process.env.MSG91_TEMPLATE_ID);
  const otpVarName = cleanText(process.env.MSG91_OTP_VAR_NAME) || "OTP";
  const endpoint = cleanText(process.env.MSG91_FLOW_ENDPOINT) || "https://control.msg91.com/api/v5/flow";

  if (!authKey || !templateId) {
    return { provider: "dev", sent: false };
  }

  const recipientMobile = phoneNumber.replace(/[^\d]/g, "");
  if (!recipientMobile) {
    throw createHttpError(400, "Invalid phone number for MSG91 delivery.");
  }

  const recipient = {
    mobiles: recipientMobile,
    [otpVarName]: otpCode,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authkey: authKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: templateId,
      short_url: 0,
      recipients: [recipient],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      cleanText(payload?.message || payload?.error || payload?.description) || "Failed to deliver OTP SMS via MSG91.";
    throw createHttpError(502, message);
  }

  const responseType = cleanText(payload?.type).toLowerCase();
  if (responseType && responseType !== "success") {
    const message =
      cleanText(payload?.message || payload?.error || payload?.description) || "Failed to deliver OTP SMS via MSG91.";
    throw createHttpError(502, message);
  }

  return { provider: "msg91", sent: true };
}

export async function sendOtpWithZeptoMail(emailAddress, otpCode) {
  const smtpHost = cleanText(process.env.ZEPTOMAIL_SMTP_HOST) || "smtp.zeptomail.in";
  const smtpPort = Number(process.env.ZEPTOMAIL_SMTP_PORT) || 587;
  const smtpPassword = cleanText(process.env.ZEPTOMAIL_SEND_MAIL_TOKEN);
  const fromAddress = cleanText(process.env.ZEPTOMAIL_FROM_ADDRESS);
  const fromName = cleanText(process.env.ZEPTOMAIL_FROM_NAME) || "Hulk Core";

  if (!smtpPassword || !fromAddress) {
    throw createHttpError(500, "ZeptoMail SMTP credentials are not configured (ZEPTOMAIL_SEND_MAIL_TOKEN, ZEPTOMAIL_FROM_ADDRESS).");
  }

  const normalizedEmail = cleanText(emailAddress).toLowerCase();
  if (!normalizedEmail) {
    throw createHttpError(400, "Valid email is required for ZeptoMail delivery.");
  }

  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: "emailapikey",
      pass: smtpPassword,
    },
  });

  const mailOptions = {
    from: {
      address: fromAddress,
      name: fromName,
    },
    to: [normalizedEmail],
    subject: "Your Hulk Core login OTP",
    html: `<div style="font-family:'Arial',sans-serif;background-color:#08080c;color:#ffffff;padding:40px 20px;text-align:center;border-top:4px solid #39FF14;border-bottom:4px solid #39FF14;"><h1 style="color:#ffffff;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;font-weight:900;">HULK<span style="color:#39FF14;">CORE</span></h1><div style="background-color:#121217;border:1px solid #2a2a35;padding:30px;border-radius:12px;max-width:400px;margin:20px auto;box-shadow:0 0 20px rgba(57,255,20,0.15);"><p style="font-size:16px;color:#a1a1aa;margin-top:0;">Your secure verification code is:</p><div style="font-size:36px;font-weight:900;color:#39FF14;letter-spacing:6px;margin:20px 0;">${otpCode}</div><p style="font-size:13px;color:#71717a;margin-bottom:0;line-height:1.5;">This code will expire shortly.<br>Do not share this with anyone.</p></div><p style="font-size:11px;color:#52525b;margin-top:30px;">© Hulk Core Supplements. All rights reserved.</p></div>`,
  };

  try {
    await transport.sendMail(mailOptions);
    return { provider: "zeptomail", sent: true };
  } catch (error) {
    throw createHttpError(502, "Failed to deliver OTP email via ZeptoMail SMTP: " + error.message);
  }
}

export async function sendOtpWithMailtrap(emailAddress, otpCode) {
  const token = cleanText(process.env.MAILTRAP_TOKEN);
  const fromAddress = cleanText(process.env.MAILTRAP_FROM_ADDRESS) || "hello@demomailtrap.com";
  const fromName = cleanText(process.env.MAILTRAP_FROM_NAME) || "Mailtrap Test";

  if (!token) {
    return { provider: "dev", sent: false };
  }

  const normalizedEmail = cleanText(emailAddress).toLowerCase();
  if (!normalizedEmail) {
    throw createHttpError(400, "Valid email is required for Mailtrap delivery.");
  }

  const transport = nodemailer.createTransport(
    MailtrapTransport({
      token: token,
    })
  );

  const mailOptions = {
    from: {
      address: fromAddress,
      name: fromName,
    },
    to: [normalizedEmail],
    subject: "Your Hulk Core login OTP",
    html: `<div style="font-family:'Arial',sans-serif;background-color:#08080c;color:#ffffff;padding:40px 20px;text-align:center;border-top:4px solid #39FF14;border-bottom:4px solid #39FF14;"><h1 style="color:#ffffff;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;font-weight:900;">HULK<span style="color:#39FF14;">CORE</span></h1><div style="background-color:#121217;border:1px solid #2a2a35;padding:30px;border-radius:12px;max-width:400px;margin:20px auto;box-shadow:0 0 20px rgba(57,255,20,0.15);"><p style="font-size:16px;color:#a1a1aa;margin-top:0;">Your secure verification code is:</p><div style="font-size:36px;font-weight:900;color:#39FF14;letter-spacing:6px;margin:20px 0;">${otpCode}</div><p style="font-size:13px;color:#71717a;margin-bottom:0;line-height:1.5;">This code will expire shortly.<br>Do not share this with anyone.</p></div><p style="font-size:11px;color:#52525b;margin-top:30px;">© Hulk Core Supplements. All rights reserved.</p></div>`,
  };

  try {
    await transport.sendMail(mailOptions);
    return { provider: "mailtrap", sent: true };
  } catch (error) {
    throw createHttpError(502, "Failed to deliver OTP email via Mailtrap: " + error.message);
  }
}
