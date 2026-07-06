import { Router } from "express";
import { createId, cleanText } from "../utils.js";
import {
  upsertEmailSuppression,
  listEmailSuppressions,
  deleteEmailSuppression,
} from "../repositories/email-suppressions.repository.js";
import { requireAdminAccess } from "../auth/index.js";
import { incrementCounter, getCounter } from "../services/redisService.js";
import { sendMail } from "../services/mailService.js";

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

    const eventTypeRaw = body.event_name || body.event_type || body.eventType || body.event || "";
    const eventTypeStr = Array.isArray(eventTypeRaw) ? eventTypeRaw[0] : eventTypeRaw;
    const eventType = cleanText(eventTypeStr).toLowerCase().replace(/\s+/g, "_");

    // Only process hard bounces and complaints — soft bounces are transient
    const suppressableEvents = new Set(["hard_bounce", "hardbounce", "complaint", "spam_complaint", "bounce"]);
    if (!suppressableEvents.has(eventType)) {
      console.log(`[webhook] ZeptoMail event acknowledged — type="${eventType}" (no action)`);
      return res.status(200).json({ status: "acknowledged", eventType });
    }

    // Extract the bounced email address — ZeptoMail nests it in different places
    const msg = Array.isArray(body.event_message) ? body.event_message[0] : (body.event_message || body);
    const emailAddress = cleanText(
      msg?.bounce_address ||
      msg?.email_info?.address ||
      msg?.email_address ||
      msg?.emailAddress ||
      msg?.recipient ||
      msg?.to_email ||
      ""
    ).toLowerCase();

    if (!emailAddress) {
      console.warn(`[webhook] ZeptoMail ${eventType} event missing email address`);
      return res.status(200).json({ status: "ignored", reason: "missing_email" });
    }

    // Map event type to a clean reason
    const reason = eventType.includes("complaint") ? "complaint" : "hard_bounce";
    const bounceType = cleanText(msg?.bounce_type || msg?.sub_type || msg?.bounce?.sub_type || "");
    const diagnostics = cleanText(msg?.details?.diagnostic_message || msg?.details?.bounce_reason || msg?.diagnostics || msg?.reason || "");

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

    // Rate calculation and alerting
    const hourKey = new Date().toISOString().slice(0, 13); // 'YYYY-MM-DDTHH'
    const bouncedCount = await incrementCounter(`mail:bounced:${hourKey}`, 86400);
    const sentCount = await getCounter(`mail:sent:${hourKey}`);
    
    // Alert if bounce rate > 5% and sent count is at least 20
    if (sentCount >= 20 && (bouncedCount / sentCount) > 0.05) {
      const alertKey = `mail:alert_sent:${hourKey}`;
      const alertAlreadySent = await getCounter(alertKey);
      
      if (!alertAlreadySent) {
        await incrementCounter(alertKey, 86400);
        
        const adminEmail = process.env.ADMIN_LOGIN_EMAIL;
        if (adminEmail) {
          const rate = ((bouncedCount / sentCount) * 100).toFixed(1);
          console.warn(`[webhook] High bounce rate detected (${rate}%)! Sending alert to ${adminEmail}`);
          
          await sendMail({
            to: adminEmail,
            subject: `⚠️ URGENT: High Email Bounce Rate (${rate}%)`,
            html: `
              <h2>Deliverability Alert</h2>
              <p>Your current email bounce rate is <strong>${rate}%</strong>.</p>
              <p>Emails Sent this hour: <strong>${sentCount}</strong></p>
              <p>Emails Bounced this hour: <strong>${bouncedCount}</strong></p>
              <p>Please check the Email Suppressions dashboard in your admin panel immediately to see why emails are failing to deliver. Consistently high bounce rates will cause ZeptoMail to suspend your account.</p>
            `,
          }).catch(err => console.error("Failed to send bounce alert", err));
        }
      }
    }

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
