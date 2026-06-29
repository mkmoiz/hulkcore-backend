import { Router } from "express";
import { createId, cleanText } from "../utils.js";
import {
  upsertEmailSuppression,
  listEmailSuppressions,
  deleteEmailSuppression,
} from "../repositories/email-suppressions.repository.js";
import { requireAdminAccess } from "../auth/index.js";

const app = Router();

// ─── ZeptoMail Webhook Authorization ─────────────────────────────
// ZeptoMail sends a custom authorization header (key + value) configured
// in their dashboard. We validate it if configured, but per ZeptoMail's
// requirements ALL responses MUST return status 200.
//
// Set in .env:
//   ZEPTOMAIL_WEBHOOK_AUTH_KEY=Authorization   (the header name)
//   ZEPTOMAIL_WEBHOOK_AUTH_VALUE=your-secret   (the header value)

function isWebhookAuthorized(req) {
  const authKey = cleanText(process.env.ZEPTOMAIL_WEBHOOK_AUTH_KEY);
  const authValue = cleanText(process.env.ZEPTOMAIL_WEBHOOK_AUTH_VALUE);

  // No auth configured — accept all (dev mode)
  if (!authKey || !authValue) {
    return true;
  }

  const providedValue = cleanText(req.get(authKey));
  return providedValue === authValue;
}

// ─── ZeptoMail Bounce/Complaint Webhook ──────────────────────────
//
// ZeptoMail requirements:
//   - Unauthenticated (no auth challenge)
//   - POST only
//   - MUST always return status 200
//
// Payload shape (varies by event type):
// {
//   "event_type": "hard_bounce" | "soft_bounce" | "complaint" | ...,
//   "bounce": { "email_address": "...", "sub_type": "...", "diagnostics": "..." },
//   "email_address": "...",
//   ...
// }

app.post("/api/webhooks/zeptomail", async (req, res) => {
  try {
    // Soft auth check — log but never reject (ZeptoMail requires 200 always)
    if (!isWebhookAuthorized(req)) {
      console.warn("[webhook] ZeptoMail authorization mismatch — processing anyway (200 required)");
    }

    const body = req.body;
    console.log("[webhook] Raw ZeptoMail payload body received:", JSON.stringify(body));

    if (!body || typeof body !== "object") {
      console.warn("[webhook] ZeptoMail empty/invalid payload received");
      return res.status(200).json({ status: "ignored", reason: "invalid_payload" });
    }

    const eventType = cleanText(body.event_type || body.eventType).toLowerCase();

    // Only process hard bounces and complaints — soft bounces are transient
    const suppressableEvents = new Set(["hard_bounce", "hardbounce", "complaint", "spam_complaint"]);
    if (!suppressableEvents.has(eventType)) {
      console.log(`[webhook] ZeptoMail event acknowledged — type="${eventType}" (no action)`);
      return res.status(200).json({ status: "acknowledged", eventType });
    }

    // Extract the bounced email address — ZeptoMail nests it in different places
    const emailAddress = cleanText(
      body.bounce?.email_address ||
      body.bounce?.emailAddress ||
      body.email_address ||
      body.emailAddress ||
      body.recipient ||
      body.to_email ||
      ""
    ).toLowerCase();

    if (!emailAddress) {
      console.warn(`[webhook] ZeptoMail ${eventType} event missing email address`, JSON.stringify(body).slice(0, 500));
      return res.status(200).json({ status: "ignored", reason: "missing_email" });
    }

    // Map event type to a clean reason
    const reason = eventType.includes("complaint") ? "complaint" : "hard_bounce";
    const bounceType = cleanText(body.bounce?.sub_type || body.bounce?.subType || body.sub_type || "");
    const diagnostics = cleanText(body.bounce?.diagnostics || body.diagnostics || body.reason || "");

    const suppression = await upsertEmailSuppression({
      id: createId("esup"),
      email: emailAddress,
      reason,
      bounceType,
      diagnostics,
      source: "webhook",
    });

    console.log(
      `[webhook] Email suppressed — email="${emailAddress}" reason="${reason}" bounceType="${bounceType}"`,
    );

    return res.status(200).json({
      status: "suppressed",
      email: emailAddress,
      reason: suppression.reason,
    });
  } catch (error) {
    // ZeptoMail requires 200 even on internal errors — log and acknowledge
    console.error("[webhook] ZeptoMail webhook processing error:", error.message);
    return res.status(200).json({ status: "error", message: "Internal processing error" });
  }
});

// ─── Admin: List Suppressed Emails ───────────────────────────────

app.get("/api/admin/email-suppressions", requireAdminAccess, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(1, Number(req.query?.limit) || 50), 200);
    const offset = Math.max(0, Number(req.query?.offset) || 0);

    const result = await listEmailSuppressions({ limit, offset });
    return res.json(result);
  } catch (error) {
    next(error);
  }
});

// ─── Admin: Remove Suppression (Unsuppress) ─────────────────────

app.delete("/api/admin/email-suppressions/:email", requireAdminAccess, async (req, res, next) => {
  try {
    const email = cleanText(req.params.email).toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const deleted = await deleteEmailSuppression(email);
    if (!deleted) {
      return res.status(404).json({ message: "Email is not suppressed." });
    }

    console.log(`[admin] Email unsuppressed — email="${email}"`);
    return res.json({ status: "unsuppressed", email });
  } catch (error) {
    next(error);
  }
});

export default app;
