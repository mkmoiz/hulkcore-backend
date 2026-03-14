import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const DEFAULT_IMAGE_PREFIX = "products";
const DEFAULT_REPORT_PREFIX = "lab-reports";

let cachedConfig = null;
let cachedClient = null;

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function trimLeadingSlash(value) {
  return value.replace(/^\/+/, "");
}

function normalizePublicUrl(publicUrl, accountId, bucketName) {
  const explicitUrl = cleanText(publicUrl);
  if (explicitUrl) {
    return trimTrailingSlash(explicitUrl);
  }

  return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com`;
}

function sanitizeFileName(fileName) {
  const baseName = basename(cleanText(fileName) || "image");
  const sanitized = baseName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || "image";
}

function resolveConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const accountId = cleanText(process.env.R2_ACCOUNT_ID);
  const accessKeyId = cleanText(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = cleanText(process.env.R2_SECRET_ACCESS_KEY);
  const bucketName = cleanText(process.env.R2_BUCKET_NAME);
  const endpoint = cleanText(process.env.R2_ENDPOINT) || `https://${accountId}.r2.cloudflarestorage.com`;
  const imagePrefix = trimLeadingSlash(cleanText(process.env.R2_IMAGE_PREFIX) || DEFAULT_IMAGE_PREFIX);
  const reportPrefix = trimLeadingSlash(cleanText(process.env.R2_REPORT_PREFIX) || DEFAULT_REPORT_PREFIX);

  cachedConfig = {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint: trimTrailingSlash(endpoint),
    publicUrl: normalizePublicUrl(process.env.R2_PUBLIC_URL, accountId, bucketName),
    imagePrefix: trimTrailingSlash(imagePrefix) || DEFAULT_IMAGE_PREFIX,
    reportPrefix: trimTrailingSlash(reportPrefix) || DEFAULT_REPORT_PREFIX,
  };

  return cachedConfig;
}

export function isR2Configured() {
  const config = resolveConfig();
  return Boolean(config.accountId && config.accessKeyId && config.secretAccessKey && config.bucketName);
}

function assertR2Configured() {
  if (!isR2Configured()) {
    throw new Error(
      "Cloudflare R2 is not configured. Required environment variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME.",
    );
  }
}

function getClient() {
  assertR2Configured();

  if (cachedClient) {
    return cachedClient;
  }

  const config = resolveConfig();
  cachedClient = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return cachedClient;
}

export function getPublicImageUrl(imageKey) {
  const key = trimLeadingSlash(cleanText(imageKey));
  if (!key) {
    return "";
  }

  const config = resolveConfig();
  return `${config.publicUrl}/${key}`;
}

export function extractR2KeyFromImageUrl(imageUrl) {
  const url = cleanText(imageUrl);
  if (!url || !isR2Configured()) {
    return "";
  }

  const config = resolveConfig();
  const normalizedPublicBase = `${config.publicUrl}/`;
  if (!url.startsWith(normalizedPublicBase)) {
    return "";
  }

  const withoutBase = url.slice(normalizedPublicBase.length);
  const [pathWithoutQuery] = withoutBase.split("?");
  return decodeURIComponent(trimLeadingSlash(pathWithoutQuery));
}

export async function uploadImageToR2({ fileBuffer, contentType, originalFileName, keyPrefix }) {
  assertR2Configured();
  const config = resolveConfig();

  const safeName = sanitizeFileName(originalFileName);
  const normalizedPrefix = trimTrailingSlash(trimLeadingSlash(cleanText(keyPrefix)));
  const prefix = normalizedPrefix || config.imagePrefix;
  const imageKey = `${prefix}/${Date.now()}-${randomUUID()}-${safeName}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: imageKey,
      Body: fileBuffer,
      ContentType: cleanText(contentType) || "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    imageKey,
    imageUrl: getPublicImageUrl(imageKey),
  };
}

export async function deleteImageFromR2ByKey(imageKey) {
  const normalizedImageKey = trimLeadingSlash(cleanText(imageKey));
  if (!normalizedImageKey) {
    return;
  }

  assertR2Configured();
  const config = resolveConfig();

  await getClient().send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: normalizedImageKey,
    }),
  );
}
