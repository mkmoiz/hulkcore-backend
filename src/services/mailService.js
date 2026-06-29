import nodemailer from "nodemailer";
import { cleanText } from "../utils.js";

// ─── Singleton Transport ─────────────────────────────────────────

let _transport = null;
let _transportVerified = false;

/**
 * Returns the shared, pooled Nodemailer transport.
 * Created lazily on first call and reused for all subsequent sends.
 */
function getTransport() {
  if (_transport) {
    return _transport;
  }

  const smtpHost = cleanText(process.env.ZEPTOMAIL_SMTP_HOST) || "smtp.zeptomail.in";
  const smtpPort = Number(process.env.ZEPTOMAIL_SMTP_PORT) || 587;
  const smtpPassword = cleanText(process.env.ZEPTOMAIL_SEND_MAIL_TOKEN);
  const maxConnections = Number(process.env.SMTP_MAX_CONNECTIONS) || 5;
  const maxMessages = Number(process.env.SMTP_MAX_MESSAGES) || 100;

  if (!smtpPassword) {
    throw new Error("ZEPTOMAIL_SEND_MAIL_TOKEN is not configured.");
  }

  _transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    pool: true,
    maxConnections,
    maxMessages,
    auth: {
      user: "emailapikey",
      pass: smtpPassword,
    },
    // Connection-level timeouts to avoid hanging forever
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });

  console.log(
    `[mail] SMTP transport created — host=${smtpHost} port=${smtpPort} pool=true maxConn=${maxConnections}`,
  );

  return _transport;
}

/**
 * Verify the SMTP connection on first use.
 * Logs the result but does not throw — a failed verify is not fatal
 * (the connection may recover by the time we actually send).
 */
async function ensureTransportVerified() {
  if (_transportVerified) {
    return;
  }

  try {
    await getTransport().verify();
    _transportVerified = true;
    console.log("[mail] SMTP connection verified successfully.");
  } catch (err) {
    console.warn("[mail] SMTP verify failed (will retry on send):", err.message);
  }
}

// ─── Retry Logic ─────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Send an email through the pooled SMTP transport with automatic retries.
 *
 * @param {Object} options
 * @param {string|string[]} options.to       — Recipient address(es)
 * @param {string}          options.subject  — Email subject
 * @param {string}          options.html     — HTML body
 * @param {string}          [options.text]   — Optional plain-text body
 * @param {{ address: string, name?: string }} [options.from] — Override from address
 * @returns {Promise<{ messageId: string, provider: string }>}
 */
export async function sendMail({ to, subject, html, text, from }) {
  await ensureTransportVerified();

  const fromAddress = from?.address || cleanText(process.env.ZEPTOMAIL_FROM_ADDRESS);
  const fromName = from?.name || cleanText(process.env.ZEPTOMAIL_FROM_NAME) || "Hulk Core";

  if (!fromAddress) {
    throw new Error("ZEPTOMAIL_FROM_ADDRESS is not configured.");
  }

  const mailOptions = {
    from: { address: fromAddress, name: fromName },
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    ...(text ? { text } : {}),
  };

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `[mail] Sending email — attempt=${attempt}/${MAX_RETRIES} to=${mailOptions.to} subject="${subject}"`,
      );

      const info = await getTransport().sendMail(mailOptions);

      console.log(
        `[mail] Email sent successfully — messageId=${info.messageId} to=${mailOptions.to}`,
      );

      return { messageId: info.messageId, provider: "zeptomail" };
    } catch (err) {
      lastError = err;
      console.error(
        `[mail] Send failed — attempt=${attempt}/${MAX_RETRIES} error="${err.message}"`,
      );

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[mail] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Gracefully close the SMTP transport pool.
 * Call this during process shutdown to release connections cleanly.
 */
export function closeMailTransport() {
  if (_transport) {
    console.log("[mail] Closing SMTP transport pool...");
    _transport.close();
    _transport = null;
    _transportVerified = false;
    console.log("[mail] SMTP transport pool closed.");
  }
}
