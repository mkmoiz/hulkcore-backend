import { createClient } from "redis";
import { cleanText } from "../utils.js";

const REDIS_ENABLED = cleanText(process.env.REDIS_ENABLED).toLowerCase() !== "false";
const REDIS_URL = cleanText(process.env.REDIS_URL);
const REDIS_CACHE_PREFIX = cleanText(process.env.REDIS_CACHE_PREFIX) || "hulk:";
const REDIS_CONNECT_TIMEOUT_MS = Math.max(1000, Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 5000);

let client = null;
let initialized = false;

function buildKey(key) {
  const normalizedKey = cleanText(key);
  if (!normalizedKey) {
    return "";
  }

  return `${REDIS_CACHE_PREFIX}${normalizedKey}`;
}

function getClient() {
  if (!client || !client.isOpen) {
    return null;
  }

  return client;
}

export async function initRedisCache() {
  if (initialized) {
    return Boolean(getClient());
  }
  initialized = true;

  if (!REDIS_ENABLED || !REDIS_URL) {
    return false;
  }

  const nextClient = createClient({
    url: REDIS_URL,
    socket: {
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    },
  });
  nextClient.on("error", (error) => {
    console.error("Redis cache error:", error?.message || error);
  });

  try {
    await nextClient.connect();
    client = nextClient;
    console.log("Redis cache connected.");
    return true;
  } catch (error) {
    console.error("Redis cache unavailable; continuing without Redis:", error?.message || error);
    try {
      await nextClient.disconnect();
    } catch {
      // noop
    }
    client = null;
    return false;
  }
}

export function isRedisCacheReady() {
  return Boolean(getClient());
}

export async function getCacheJson(key) {
  const redis = getClient();
  const redisKey = buildKey(key);
  if (!redis || !redisKey) {
    return null;
  }

  try {
    const raw = await redis.get(redisKey);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error("Redis cache read failed:", error?.message || error);
    return null;
  }
}

export async function setCacheJson(key, value, ttlSeconds = 0) {
  const redis = getClient();
  const redisKey = buildKey(key);
  if (!redis || !redisKey) {
    return false;
  }

  try {
    const payload = JSON.stringify(value);
    const ttl = Number(ttlSeconds);
    if (Number.isInteger(ttl) && ttl > 0) {
      await redis.set(redisKey, payload, { EX: ttl });
    } else {
      await redis.set(redisKey, payload);
    }
    return true;
  } catch (error) {
    console.error("Redis cache write failed:", error?.message || error);
    return false;
  }
}

export async function deleteCacheKey(key) {
  const redis = getClient();
  const redisKey = buildKey(key);
  if (!redis || !redisKey) {
    return false;
  }

  try {
    await redis.del(redisKey);
    return true;
  } catch (error) {
    console.error("Redis cache delete failed:", error?.message || error);
    return false;
  }
}

export async function deleteCacheKeys(keys) {
  const redis = getClient();
  if (!redis || !Array.isArray(keys) || keys.length === 0) {
    return false;
  }

  const redisKeys = keys.map(buildKey).filter(Boolean);
  if (redisKeys.length === 0) {
    return false;
  }

  try {
    await redis.del(redisKeys);
    return true;
  } catch (error) {
    console.error("Redis cache bulk delete failed:", error?.message || error);
    return false;
  }
}

export async function deleteCacheByPrefix(prefix) {
  const redis = getClient();
  const normalizedPrefix = cleanText(prefix);
  if (!redis || !normalizedPrefix) {
    return 0;
  }

  const pattern = `${REDIS_CACHE_PREFIX}${normalizedPrefix}*`;
  let deletedCount = 0;

  try {
    const batch = [];
    for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      batch.push(key);
      if (batch.length >= 100) {
        await redis.del(batch);
        deletedCount += batch.length;
        batch.length = 0;
      }
    }

    if (batch.length > 0) {
      await redis.del(batch);
      deletedCount += batch.length;
    }

    return deletedCount;
  } catch (error) {
    console.error("Redis cache prefix delete failed:", error?.message || error);
    return deletedCount;
  }
}
