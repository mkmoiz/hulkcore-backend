import { cleanText } from "../utils.js";

function readRequiredEnvWithDevFallback(envName, developmentFallback) {
  const value = cleanText(process.env[envName]);
  if (value) {
    return value;
  }

  const nodeEnv = cleanText(process.env.NODE_ENV).toLowerCase();
  if (nodeEnv === "production") {
    throw new Error(`Missing required environment variable: ${envName}`);
  }

  if (nodeEnv === "development" || nodeEnv === "test") {
    return developmentFallback;
  }

  throw new Error(
    `Missing required environment variable: ${envName}. Set NODE_ENV=development/test to use local fallbacks.`,
  );
}

export const PORT = Number(process.env.PORT) || 4000;
export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_REPORT_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const THEME_CODE_PATTERN = /^[a-z0-9_-]{2,64}$/;
export const HEX_COLOR_PATTERN = /^#?[0-9a-fA-F]{6}$/;
export const HOME_ICON_KEY_PATTERN = /^[a-z0-9-]{2,64}$/;
export const CUSTOMER_REF_PATTERN = /^[a-zA-Z0-9_-]{3,128}$/;
export const PHONE_E164_PATTERN = /^\+[1-9]\d{7,14}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const OTP_CODE_PATTERN = /^\d{4,8}$/;
export const THEME_MODES = new Set(["light", "dark", "night"]);
export const LEVEL_RULE_MODES = new Set(["CURATED", "DYNAMIC"]);
export const LEVEL_SORT_MODES = new Set(["featured", "newest", "price_low_high", "price_high_low", "name_az"]);
export const OTP_TTL_MS = Math.max(30_000, Number(process.env.OTP_TTL_MS) || 5 * 60 * 1000);
export const OTP_MAX_ATTEMPTS = Math.max(1, Number(process.env.OTP_MAX_ATTEMPTS) || 5);
export const AUTH_SESSION_TTL_MS = Math.max(60_000, Number(process.env.AUTH_SESSION_TTL_MS) || 30 * 24 * 60 * 60 * 1000);
export const OTP_HASH_SECRET = readRequiredEnvWithDevFallback("OTP_HASH_SECRET", "hulkcore-dev-otp-secret");
export const USER_AUTH_COOKIE_NAME = cleanText(process.env.USER_AUTH_COOKIE_NAME) || "hulk_auth_token";
export const USER_AUTH_COOKIE_TTL_SEC = Math.max(60, Math.floor(AUTH_SESSION_TTL_MS / 1000));
export const ADMIN_AUTH_COOKIE_NAME = cleanText(process.env.ADMIN_AUTH_COOKIE_NAME) || "hulk_admin_session";
export const ADMIN_SESSION_TTL_SEC = Math.max(300, Number(process.env.ADMIN_SESSION_TTL_SEC) || 7 * 24 * 60 * 60);
export const ADMIN_LOGIN_EMAIL = readRequiredEnvWithDevFallback("ADMIN_LOGIN_EMAIL", "admin@hulkcore.local").toLowerCase();
export const ADMIN_LOGIN_PASSWORD = readRequiredEnvWithDevFallback("ADMIN_LOGIN_PASSWORD", "admin123");
export const ADMIN_LOGIN_NAME = cleanText(process.env.ADMIN_LOGIN_NAME || "Hulk Admin");
export const COOKIE_SECURE = cleanText(process.env.COOKIE_SECURE).toLowerCase() === "true";
export const COOKIE_SAME_SITE = (() => {
  const rawValue = cleanText(process.env.COOKIE_SAME_SITE).toLowerCase();
  if (rawValue === "strict") {
    return "Strict";
  }
  if (rawValue === "none") {
    return "None";
  }
  return "Lax";
})();
export const RAZORPAY_API_BASE_URL = "https://api.razorpay.com/v1";
export const ADMIN_ROLE_HEADER = "x-admin-role";
export const ADMIN_TOKEN_HEADER = "x-admin-token";
export const ADMIN_ROLE_VALUE = "admin";
export const ADMIN_API_TOKEN = cleanText(process.env.ADMIN_API_TOKEN || process.env.ADMIN_TOKEN);
export const NAV_PUBLIC_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";
export const PUBLIC_NAV_CACHE_TTL_SEC = Math.max(30, Number(process.env.PUBLIC_NAV_CACHE_TTL_SEC) || 300);
export const PUBLIC_ENTITY_CACHE_TTL_SEC = Math.max(30, Number(process.env.PUBLIC_ENTITY_CACHE_TTL_SEC) || 120);
export const NAV_MENU_CACHE = new Map();
export const PUBLIC_COLLECTIONS_CACHE_KEY = "public:collections:v1";
export const PUBLIC_LEVELS_CACHE_KEY = "public:levels:v1";
export const PUBLIC_LEVEL_DETAIL_CACHE_PREFIX = "public:levels:detail:v1:";
export const PUBLIC_OFFERS_CACHE_KEY = "public:offers:v1";
export const PUBLIC_COMBO_OFFERS_CACHE_KEY = "public:combo-offers:v1";
export const PUBLIC_BEST_SELLERS_CACHE_KEY = "public:best-sellers:v1";
export const PUBLIC_LAB_REPORTS_CACHE_KEY = "public:lab-reports:v1";
export const ORDER_STATUSES = new Set([
  "placed",
  "purchased",
  "failed",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
]);
export const ORDER_PAYMENT_STATUSES = new Set(["pending", "authorized", "paid", "failed", "refunded", "partial_refund"]);
export const DEFAULT_CORS_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
];
export const CORS_ALLOWED_ORIGINS = cleanText(process.env.CORS_ALLOWED_ORIGINS)
  .split(",")
  .map((entry) => cleanText(entry))
  .filter(Boolean);
export const CORS_ALLOWED_ORIGIN_SET = new Set(CORS_ALLOWED_ORIGINS.length > 0 ? CORS_ALLOWED_ORIGINS : DEFAULT_CORS_ALLOWED_ORIGINS);
export const REPORT_UPLOAD_PREFIX = cleanText(process.env.R2_REPORT_PREFIX) || "lab-reports";
export const REPORT_MIME_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/acrobat",
  "applications/vnd.pdf",
  "text/pdf",
  "text/x-pdf",
]);
