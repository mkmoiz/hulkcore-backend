import { createHash } from "node:crypto";
import {
  NAV_MENU_CACHE,
  PUBLIC_BEST_SELLERS_CACHE_KEY,
  PUBLIC_COMBO_OFFERS_CACHE_KEY,
  PUBLIC_COLLECTIONS_CACHE_KEY,
  PUBLIC_LAB_REPORTS_CACHE_KEY,
  PUBLIC_LEVELS_CACHE_KEY,
  PUBLIC_LEVEL_DETAIL_CACHE_PREFIX,
  PUBLIC_NAV_CACHE_TTL_SEC,
  PUBLIC_OFFERS_CACHE_KEY,
} from "../config/environment.js";
import { deleteCacheByPrefix, deleteCacheKey, getCacheJson, setCacheJson } from "../redisCache.js";

export function navCacheKey(menuKey) {
  return `nav:${menuKey}`;
}

export function computePayloadEtag(payload) {
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return `W/\"${hash}\"`;
}

export function setPublicNavCacheEntry(menuKey, payload) {
  const key = navCacheKey(menuKey);
  const etag = computePayloadEtag(payload);
  NAV_MENU_CACHE.set(key, {
    etag,
    payload,
  });
  return {
    etag,
    payload,
  };
}

export async function cachePublicNavMenu(menuKey, payload) {
  const entry = setPublicNavCacheEntry(menuKey, payload);
  await setCacheJson(navCacheKey(menuKey), payload, PUBLIC_NAV_CACHE_TTL_SEC);
  return entry;
}

export async function readPublicNavCacheEntry(menuKey) {
  const key = navCacheKey(menuKey);
  const inMemory = NAV_MENU_CACHE.get(key);
  if (inMemory) {
    return inMemory;
  }

  const cachedPayload = await getCacheJson(key);
  if (!cachedPayload) {
    return null;
  }

  return setPublicNavCacheEntry(menuKey, cachedPayload);
}

export async function invalidatePublicNavCache(menuKey) {
  NAV_MENU_CACHE.delete(navCacheKey(menuKey));
  await deleteCacheKey(navCacheKey(menuKey));
}

export async function invalidatePublicCollectionsCache() {
  await deleteCacheKey(PUBLIC_COLLECTIONS_CACHE_KEY);
}

export async function invalidatePublicLevelsCache() {
  await deleteCacheKey(PUBLIC_LEVELS_CACHE_KEY);
  await deleteCacheByPrefix(PUBLIC_LEVEL_DETAIL_CACHE_PREFIX);
}

export async function invalidatePublicOffersCache() {
  await deleteCacheKey(PUBLIC_OFFERS_CACHE_KEY);
}

export async function invalidatePublicComboOffersCache() {
  await deleteCacheKey(PUBLIC_COMBO_OFFERS_CACHE_KEY);
}

export async function invalidatePublicBestSellersCache() {
  await deleteCacheKey(PUBLIC_BEST_SELLERS_CACHE_KEY);
}

export async function invalidatePublicLabReportsCache() {
  await deleteCacheKey(PUBLIC_LAB_REPORTS_CACHE_KEY);
}

export async function invalidatePublicCatalogCaches() {
  await Promise.all([
    invalidatePublicCollectionsCache(),
    invalidatePublicLevelsCache(),
    invalidatePublicOffersCache(),
    invalidatePublicComboOffersCache(),
    invalidatePublicBestSellersCache(),
    invalidatePublicLabReportsCache(),
  ]);
}

export async function invalidatePublicProductDependentCaches() {
  await Promise.all([
    invalidatePublicLevelsCache(),
    invalidatePublicOffersCache(),
    invalidatePublicComboOffersCache(),
    invalidatePublicBestSellersCache(),
    invalidatePublicLabReportsCache(),
  ]);
}
