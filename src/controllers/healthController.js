import { Router } from "express";
import * as core from "./index.js";

const app = Router();
Object.assign(globalThis, core);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "hulkcore-backend",
    timestamp: new Date().toISOString(),
  });
});
app.post("/api/admin/auth/login", async (req, res, next) => {
  try {
    const email = cleanText(req.body?.email).toLowerCase();
    const password = cleanText(req.body?.password);
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    if (email !== ADMIN_LOGIN_EMAIL) {
      return res.status(401).json({ message: "Invalid admin credentials." });
    }

    const passwordValid = isScryptHash(ADMIN_LOGIN_PASSWORD)
      ? await verifyPassword(password, ADMIN_LOGIN_PASSWORD)
      : password === ADMIN_LOGIN_PASSWORD;

    if (!passwordValid) {
      return res.status(401).json({ message: "Invalid admin credentials." });
    }

    const sessionId = createId("adms");
    const session = createAdminSessionPayload(sessionId);
    await persistAdminSession(session);
    setCookie(res, ADMIN_AUTH_COOKIE_NAME, sessionId, {
      maxAge: ADMIN_SESSION_TTL_SEC,
      path: "/",
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: COOKIE_SAME_SITE,
    });

    return res.json({ session });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/auth/session", async (req, res, next) => {
  try {
    const session = await resolveAdminSession(req);
    if (!session) {
      return res.status(401).json({ message: "Admin session not found." });
    }

    return res.json({ session });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/auth/logout", async (req, res, next) => {
  try {
    const sessionId = readCookieValue(req, ADMIN_AUTH_COOKIE_NAME);
    if (sessionId) {
      await deleteAdminSession(sessionId);
    }
    clearCookie(res, ADMIN_AUTH_COOKIE_NAME);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});


export default app;
