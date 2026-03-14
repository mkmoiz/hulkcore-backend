import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

app.post("/api/auth/otp/request", async (req, res, next) => {
  try {
    const phoneNumber = normalizePhoneNumber(req.body?.phone);
    if (!PHONE_E164_PATTERN.test(phoneNumber)) {
      return res.status(400).json({
        message: "Valid phone number is required (e.g. +919876543210).",
      });
    }

    const challengeId = createId("otp");
    const otpCode = generateOtpCode();
    const otpHash = hashOtpCode({
      phone: phoneNumber,
      challengeId,
      otpCode,
    });
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    const challenge = await createOtpChallenge({
      id: challengeId,
      phone: phoneNumber,
      otpHash,
      expiresAt,
      attemptsRemaining: OTP_MAX_ATTEMPTS,
    });

    const delivery = await sendOtpWithMsg91(phoneNumber, otpCode);

    return res.status(201).json({
      challengeId: challenge.id,
      phone: maskPhoneNumber(phoneNumber),
      expiresAt: challenge.expiresAt,
      provider: delivery.provider,
      ...(process.env.NODE_ENV !== "production" ? { devOtp: otpCode } : {}),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/otp/verify", async (req, res, next) => {
  try {
    const phoneNumber = normalizePhoneNumber(req.body?.phone);
    const challengeId = cleanText(req.body?.challengeId);
    const otpCode = cleanText(req.body?.otp);

    if (!PHONE_E164_PATTERN.test(phoneNumber)) {
      return res.status(400).json({ message: "Valid phone number is required." });
    }

    if (!challengeId) {
      return res.status(400).json({ message: "OTP challenge id is required." });
    }

    if (!OTP_CODE_PATTERN.test(otpCode)) {
      return res.status(400).json({ message: "OTP must be 4-8 digits." });
    }

    const otpHash = hashOtpCode({
      phone: phoneNumber,
      challengeId,
      otpCode,
    });
    const authSession = await verifyOtpChallengeAndCreateSession({
      phone: phoneNumber,
      challengeId,
      otpHash,
      sessionTtlMs: AUTH_SESSION_TTL_MS,
    });

    setCookie(res, USER_AUTH_COOKIE_NAME, authSession.token, {
      maxAge: USER_AUTH_COOKIE_TTL_SEC,
      path: "/",
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: COOKIE_SAME_SITE,
    });

    return res.json({
      token: authSession.token,
      expiresAt: authSession.expiresAt,
      user: authSession.user,
      customerRef: authSession.user?.id || "",
    });
  } catch (error) {
    next(error);
  }
});

app.post(["/api/auth/email/otp/request", "/api/auth/email/request"], async (req, res, next) => {
  try {
    const email = normalizeEmailAddress(req.body?.email);
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({
        message: "Valid email is required.",
      });
    }

    const challengeId = createId("eotp");
    const otpCode = generateOtpCode();
    const otpHash = hashOtpCode({
      email,
      challengeId,
      otpCode,
    });
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    const challenge = await createEmailOtpChallenge({
      id: challengeId,
      email,
      otpHash,
      expiresAt,
      attemptsRemaining: OTP_MAX_ATTEMPTS,
    });

    const delivery = await sendOtpWithZeptoMail(email, otpCode);

    return res.status(201).json({
      challengeId: challenge.id,
      email: maskEmailAddress(email),
      expiresAt: challenge.expiresAt,
      provider: delivery.provider,
      ...(process.env.NODE_ENV !== "production" ? { devOtp: otpCode } : {}),
    });
  } catch (error) {
    next(error);
  }
});

app.post(["/api/auth/email/otp/verify", "/api/auth/email/verify"], async (req, res, next) => {
  try {
    const email = normalizeEmailAddress(req.body?.email);
    const challengeId = cleanText(req.body?.challengeId);
    const otpCode = cleanText(req.body?.otp);

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: "Valid email is required." });
    }

    if (!challengeId) {
      return res.status(400).json({ message: "OTP challenge id is required." });
    }

    if (!OTP_CODE_PATTERN.test(otpCode)) {
      return res.status(400).json({ message: "OTP must be 4-8 digits." });
    }

    const otpHash = hashOtpCode({
      email,
      challengeId,
      otpCode,
    });
    const authSession = await verifyEmailOtpChallengeAndCreateSession({
      email,
      challengeId,
      otpHash,
      sessionTtlMs: AUTH_SESSION_TTL_MS,
    });

    setCookie(res, USER_AUTH_COOKIE_NAME, authSession.token, {
      maxAge: USER_AUTH_COOKIE_TTL_SEC,
      path: "/",
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: COOKIE_SAME_SITE,
    });

    return res.json({
      token: authSession.token,
      expiresAt: authSession.expiresAt,
      user: authSession.user,
      customerRef: authSession.user?.id || "",
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/session", async (req, res, next) => {
  try {
    const authToken = extractAuthToken(req);
    if (!authToken) {
      return res.status(401).json({ message: "Session token is required." });
    }

    const authSession = await findAuthSessionByToken(authToken);
    if (!authSession) {
      return res.status(401).json({ message: "Session expired or invalid." });
    }

    return res.json({
      token: authSession.token,
      expiresAt: authSession.expiresAt,
      user: authSession.user,
      customerRef: authSession.user?.id || "",
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/auth/profile", async (req, res, next) => {
  try {
    const authSession = await requireAuthenticatedSession(req, res);
    if (!authSession) {
      return;
    }

    const fullName = cleanText(req.body?.fullName);
    const email = cleanText(req.body?.email);
    const addressLine1 = cleanText(req.body?.addressLine1);
    const addressLine2 = cleanText(req.body?.addressLine2);
    const city = cleanText(req.body?.city);
    const state = cleanText(req.body?.state);
    const postalCode = cleanText(req.body?.postalCode);
    const country = cleanText(req.body?.country);
    const updatedUser = await upsertUserProfile(authSession.user.id, {
      fullName,
      email,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
    });

    return res.json({
      token: authSession.token,
      expiresAt: authSession.expiresAt,
      user: updatedUser,
      customerRef: updatedUser.id,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", async (req, res, next) => {
  try {
    const authToken = extractAuthToken(req);
    if (authToken) {
      await deleteAuthSessionByToken(authToken);
    }

    clearCookie(res, USER_AUTH_COOKIE_NAME);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});


export default app;
