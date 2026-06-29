import { getPrisma } from "../db/prisma.js";

/**
 * Check if an email address is suppressed (bounced or complained).
 * @param {string} email — Lowercase email address
 * @returns {Promise<object|null>} The suppression record, or null if not suppressed
 */
export async function findEmailSuppression(email, prismaClient = getPrisma()) {
  const row = await prismaClient.emailSuppression.findUnique({
    where: { email },
  });

  return row ?? null;
}

/**
 * Check if an email is suppressed (boolean shorthand).
 * @param {string} email — Lowercase email address
 * @returns {Promise<boolean>}
 */
export async function isEmailSuppressed(email, prismaClient = getPrisma()) {
  const row = await prismaClient.emailSuppression.findUnique({
    where: { email },
    select: { id: true },
  });

  return Boolean(row);
}

/**
 * Upsert an email suppression record.
 * If the email is already suppressed, update the reason/diagnostics.
 * @param {object} input
 * @param {string} input.id       — Unique ID for the record
 * @param {string} input.email    — Lowercase email address
 * @param {string} input.reason   — "hard_bounce" | "complaint" | "manual"
 * @param {string} [input.bounceType] — e.g. "mailbox_not_found", "domain_not_found"
 * @param {string} [input.diagnostics] — Raw diagnostic string from the provider
 * @param {string} [input.source] — "webhook" | "manual" | "api"
 * @returns {Promise<object>} The created or updated suppression record
 */
export async function upsertEmailSuppression(input, prismaClient = getPrisma()) {
  const now = new Date();

  return prismaClient.emailSuppression.upsert({
    where: { email: input.email },
    create: {
      id: input.id,
      email: input.email,
      reason: input.reason,
      bounceType: input.bounceType || "",
      diagnostics: input.diagnostics || "",
      source: input.source || "webhook",
      createdAt: now,
      updatedAt: now,
    },
    update: {
      reason: input.reason,
      bounceType: input.bounceType || "",
      diagnostics: input.diagnostics || "",
      source: input.source || "webhook",
      updatedAt: now,
    },
  });
}

/**
 * Remove a suppression (e.g. admin manually un-suppressing an email).
 * @param {string} email — Lowercase email address
 * @returns {Promise<boolean>} True if a record was deleted
 */
export async function deleteEmailSuppression(email, prismaClient = getPrisma()) {
  try {
    await prismaClient.emailSuppression.delete({
      where: { email },
    });
    return true;
  } catch (error) {
    // P2025 = record not found — not an error for delete
    if (error?.code === "P2025") {
      return false;
    }
    throw error;
  }
}

/**
 * List all suppressed emails (for admin dashboard).
 * @param {object} options
 * @param {number} [options.limit=50]
 * @param {number} [options.offset=0]
 * @returns {Promise<{ suppressions: object[], total: number }>}
 */
export async function listEmailSuppressions({ limit = 50, offset = 0 } = {}, prismaClient = getPrisma()) {
  const [suppressions, total] = await Promise.all([
    prismaClient.emailSuppression.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prismaClient.emailSuppression.count(),
  ]);

  return { suppressions, total };
}
