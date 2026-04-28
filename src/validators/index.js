import { normalizeNavMenuItems, normalizeNavMenuMeta } from "../navMenu.js";
import { categoryExists, findProductById } from "../store.js";
import {
  HOME_ICON_KEY_PATTERN,
  LEVEL_RULE_MODES,
  LEVEL_SORT_MODES,
  THEME_CODE_PATTERN,
} from "../config/environment.js";
import { cleanText, slugify, toNonNegativeInt, toNumber } from "../utils.js";
import { normalizeLevelSortMode, normalizeProductImagesPayload, resolveImageKeyFromPayload } from "../utils/runtimeHelpers.js";

const DEFAULT_HOME_ICON_KEY = "shield";

export function validateHomeIconKey(value, fallback) {
  const normalized = cleanText(value || fallback).toLowerCase();
  if (!normalized || !HOME_ICON_KEY_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

export function validateHomeContentStringList(value, maxItems = 12) {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, maxItems);

  return normalized;
}

export function validateHomeContentPayload(body, existingHomeContent) {
  const customerCode = normalizeThemeCode(body?.customerCode ?? existingHomeContent?.customerCode ?? "default");
  if (!customerCode) {
    return {
      error: "Customer code must be 2-64 chars using lowercase letters, numbers, hyphen, or underscore.",
    };
  }

  const heroSource =
    body?.hero && typeof body.hero === "object"
      ? body.hero
      : existingHomeContent?.hero && typeof existingHomeContent.hero === "object"
        ? existingHomeContent.hero
        : {};
  const statsSource = Array.isArray(body?.stats) ? body.stats : existingHomeContent?.stats ?? [];
  const featuresSource = Array.isArray(body?.features)
    ? body.features
    : existingHomeContent?.features ?? [];
  const benefitsSource = Array.isArray(body?.benefits)
    ? body.benefits
    : existingHomeContent?.benefits ?? [];
  const bundlesSource = Array.isArray(body?.bundles)
    ? body.bundles
    : existingHomeContent?.bundles ?? [];
  const reviewsSource = Array.isArray(body?.reviews)
    ? body.reviews
    : existingHomeContent?.reviews ?? [];
  const articlesSource = Array.isArray(body?.articles)
    ? body.articles
    : existingHomeContent?.articles ?? [];
  const socialProofSource =
    body?.socialProof && typeof body.socialProof === "object"
      ? body.socialProof
      : existingHomeContent?.socialProof && typeof existingHomeContent.socialProof === "object"
        ? existingHomeContent.socialProof
        : {};
  const communitySource =
    body?.community && typeof body.community === "object"
      ? body.community
      : existingHomeContent?.community && typeof existingHomeContent.community === "object"
        ? existingHomeContent.community
        : {};
  const finalCtaSource =
    body?.finalCta && typeof body.finalCta === "object"
      ? body.finalCta
      : existingHomeContent?.finalCta && typeof existingHomeContent.finalCta === "object"
        ? existingHomeContent.finalCta
        : {};

  const hero = {
    eyebrow: cleanText(heroSource?.eyebrow),
    headline: cleanText(heroSource?.headline),
    description: cleanText(heroSource?.description),
  };

  const stats = [];
  for (const [index, stat] of statsSource.entries()) {
    const value = cleanText(stat?.value);
    const label = cleanText(stat?.label);
    const iconKey = validateHomeIconKey(stat?.iconKey, DEFAULT_HOME_ICON_KEY);
    if (!value || !label || !iconKey) {
      return { error: `Invalid stats entry at index ${index}.` };
    }
    stats.push({ value, label, iconKey });
  }

  const features = [];
  for (const [index, feature] of featuresSource.entries()) {
    const title = cleanText(feature?.title);
    const description = cleanText(feature?.description);
    const iconKey = validateHomeIconKey(
      feature?.iconKey,
      DEFAULT_HOME_ICON_KEY,
    );
    if (!title || !description || !iconKey) {
      return { error: `Invalid features entry at index ${index}.` };
    }
    features.push({ title, description, iconKey });
  }

  const benefits = [];
  for (const [index, benefit] of benefitsSource.entries()) {
    const title = cleanText(benefit?.title);
    const description = cleanText(benefit?.description);
    const iconKey = validateHomeIconKey(
      benefit?.iconKey,
      DEFAULT_HOME_ICON_KEY,
    );
    if (!title || !description || !iconKey) {
      return { error: `Invalid benefits entry at index ${index}.` };
    }
    benefits.push({ title, description, iconKey });
  }

  const bundles = [];
  for (const [index, bundle] of bundlesSource.entries()) {
    const name = cleanText(bundle?.name);
    const description = cleanText(bundle?.description);
    const items = validateHomeContentStringList(bundle?.items, 12);
    const saveLabel = cleanText(bundle?.saveLabel);
    const cta = cleanText(bundle?.cta);
    if (!name || !description || !items || items.length === 0 || !saveLabel || !cta) {
      return { error: `Invalid bundles entry at index ${index}.` };
    }
    bundles.push({ name, description, items, saveLabel, cta });
  }

  const reviews = [];
  for (const [index, review] of reviewsSource.entries()) {
    const name = cleanText(review?.name);
    const goal = cleanText(review?.goal);
    const quote = cleanText(review?.quote);
    const rating = cleanText(review?.rating);
    if (!name || !goal || !quote || !rating) {
      return { error: `Invalid reviews entry at index ${index}.` };
    }
    reviews.push({ name, goal, quote, rating });
  }

  const articles = [];
  for (const [index, article] of articlesSource.entries()) {
    const title = cleanText(article?.title);
    const summary = cleanText(article?.summary);
    const tag = cleanText(article?.tag);
    const readTime = cleanText(article?.readTime);
    if (!title || !summary || !tag || !readTime) {
      return { error: `Invalid articles entry at index ${index}.` };
    }
    articles.push({ title, summary, tag, readTime });
  }

  const socialProofLogosSource = Array.isArray(socialProofSource?.logos)
    ? socialProofSource.logos
    : Array.isArray(existingHomeContent?.socialProof?.logos)
      ? existingHomeContent.socialProof.logos
      : [];
  const socialProof = {
    eyebrow: cleanText(socialProofSource?.eyebrow),
    headline: cleanText(socialProofSource?.headline),
    ratingText: cleanText(socialProofSource?.ratingText),
    logos: socialProofLogosSource.map((item) => cleanText(item)).filter(Boolean).slice(0, 8),
  };

  const community = {
    eyebrow: cleanText(communitySource?.eyebrow),
    title: cleanText(communitySource?.title),
    subtitle: cleanText(communitySource?.subtitle),
  };

  const finalCta = {
    eyebrow: cleanText(finalCtaSource?.eyebrow),
    headline: cleanText(finalCtaSource?.headline),
    description: cleanText(finalCtaSource?.description),
    ctaLabel: cleanText(finalCtaSource?.ctaLabel),
    ctaHref: cleanText(finalCtaSource?.ctaHref),
    badge: cleanText(finalCtaSource?.badge),
  };

  return {
    value: {
      customerCode,
      hero,
      stats: stats.slice(0, 12),
      features: features.slice(0, 16),
      benefits: benefits.slice(0, 16),
      bundles: bundles.slice(0, 16),
      reviews: reviews.slice(0, 24),
      articles: articles.slice(0, 24),
      socialProof,
      community,
      finalCta,
    },
  };
}

export function normalizeThemeCode(value) {
  const trimmedValue = cleanText(value).toLowerCase();
  if (!trimmedValue) {
    return "default";
  }

  if (!THEME_CODE_PATTERN.test(trimmedValue)) {
    return null;
  }

  return trimmedValue;
}

export async function validateCategoryPayload(body, existingCategory) {
  const hasOwnField = (fieldName) => Object.prototype.hasOwnProperty.call(body ?? {}, fieldName);

  const name = cleanText(body?.name ?? existingCategory?.name);
  const description = cleanText(body?.description ?? existingCategory?.description);
  const imageUrl = cleanText(hasOwnField("imageUrl") ? body?.imageUrl : existingCategory?.imageUrl);
  const imageKeyCandidate = hasOwnField("imageKey")
    ? body?.imageKey
    : hasOwnField("imageUrl")
      ? ""
      : existingCategory?.imageKey;
  const imageKey = resolveImageKeyFromPayload(imageKeyCandidate, imageUrl);

  if (!name) {
    return { error: "Category name is required." };
  }

  if (imageKey && !imageUrl) {
    return { error: "Image URL is required when image key is provided." };
  }

  return {
    value: {
      name,
      slug: slugify(name),
      description,
      imageUrl,
      imageKey,
    },
  };
}

export async function validateCollectionPayload(body, existingCollection) {
  const hasOwnField = (fieldName) => Object.prototype.hasOwnProperty.call(body ?? {}, fieldName);

  const name = cleanText(body?.name ?? existingCollection?.name);
  const imageUrl = cleanText(hasOwnField("imageUrl") ? body?.imageUrl : existingCollection?.imageUrl);
  const imageKeyCandidate = hasOwnField("imageKey")
    ? body?.imageKey
    : hasOwnField("imageUrl")
      ? ""
      : existingCollection?.imageKey;
  const imageKey = resolveImageKeyFromPayload(imageKeyCandidate, imageUrl);
  const position = toNonNegativeInt(body?.position ?? existingCollection?.position, existingCollection?.position ?? 0);
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : existingCollection?.isActive ?? true;

  if (!name) {
    return { error: "Collection name is required." };
  }

  if (position === null) {
    return { error: "Collection position must be a valid non-negative integer." };
  }

  if (imageKey && !imageUrl) {
    return { error: "Collection image URL is required when image key is provided." };
  }

  return {
    value: {
      name,
      slug: slugify(name),
      imageUrl,
      imageKey,
      position,
      isActive,
    },
  };
}

export function validateCollectionCategoryIdsPayload(body) {
  if (!Array.isArray(body?.categoryIds)) {
    return { error: "categoryIds must be an array." };
  }

  const normalizedCategoryIds = body.categoryIds.map((categoryId) => cleanText(categoryId)).filter(Boolean);

  const uniqueCategoryIds = Array.from(new Set(normalizedCategoryIds));
  return {
    value: uniqueCategoryIds,
  };
}

export async function validateLevelPayload(body, existingLevel) {
  const hasOwnField = (fieldName) => Object.prototype.hasOwnProperty.call(body ?? {}, fieldName);
  const name = cleanText(body?.name ?? existingLevel?.name);
  const description = cleanText(body?.description ?? existingLevel?.description);
  const imageUrl = cleanText(hasOwnField("imageUrl") ? body?.imageUrl : existingLevel?.imageUrl);
  const imageKeyCandidate = hasOwnField("imageKey")
    ? body?.imageKey
    : hasOwnField("imageUrl")
      ? ""
      : existingLevel?.imageKey;
  const imageKey = resolveImageKeyFromPayload(imageKeyCandidate, imageUrl);
  const position = toNonNegativeInt(body?.position ?? existingLevel?.position, existingLevel?.position ?? 0);
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : existingLevel?.isActive ?? true;
  const ruleModeCandidate = cleanText(body?.ruleMode ?? existingLevel?.ruleMode).toUpperCase();
  const ruleMode = LEVEL_RULE_MODES.has(ruleModeCandidate) ? ruleModeCandidate : "CURATED";
  const sortMode = normalizeLevelSortMode(body?.sortMode ?? existingLevel?.sortMode, "featured");

  let includeCategoryIdsSource = existingLevel?.includeCategoryIds ?? [];
  if (hasOwnField("includeCategoryIds")) {
    includeCategoryIdsSource = body?.includeCategoryIds;
  }
  if (!Array.isArray(includeCategoryIdsSource)) {
    return { error: "includeCategoryIds must be an array." };
  }

  const normalizedCategoryIds = Array.from(
    new Set(
      includeCategoryIdsSource
        .map((categoryId) => cleanText(categoryId))
        .filter(Boolean),
    ),
  );

  if (!name) {
    return { error: "Level name is required." };
  }

  if (position === null) {
    return { error: "Level position must be a valid non-negative integer." };
  }

  if (!LEVEL_RULE_MODES.has(ruleMode)) {
    return { error: "Rule mode must be CURATED or DYNAMIC." };
  }

  if (!LEVEL_SORT_MODES.has(sortMode)) {
    return { error: "Sort mode is invalid." };
  }

  if (imageKey && !imageUrl) {
    return { error: "Level image URL is required when image key is provided." };
  }

  for (const categoryId of normalizedCategoryIds) {
    const exists = await categoryExists(categoryId);
    if (!exists) {
      return { error: `Category does not exist: ${categoryId}` };
    }
  }

  return {
    value: {
      name,
      slug: slugify(name),
      description,
      imageUrl,
      imageKey,
      position,
      isActive,
      ruleMode,
      sortMode,
      includeCategoryIds: normalizedCategoryIds,
    },
  };
}

export async function validateLevelProductsPayload(body) {
  if (!Array.isArray(body?.items)) {
    return { error: "items must be an array." };
  }

  const normalized = [];
  const seenProductIds = new Set();

  for (const [index, item] of body.items.entries()) {
    const productId = cleanText(item?.productId);
    if (!productId) {
      return { error: `Level product at index ${index} is missing productId.` };
    }

    if (seenProductIds.has(productId)) {
      return { error: `Duplicate product in level payload: ${productId}.` };
    }

    const product = await findProductById(productId);
    if (!product) {
      return { error: `Level product not found: ${productId}.` };
    }

    const position = toNonNegativeInt(item?.position, index);
    if (position === null) {
      return { error: `Level product position at index ${index} must be non-negative integer.` };
    }

    seenProductIds.add(productId);
    normalized.push({
      productId,
      position,
      isPinned: Boolean(item?.isPinned),
    });
  }

  return {
    value: normalized
      .sort((a, b) => a.position - b.position)
      .map((entry, index) => ({
        ...entry,
        position: index,
      })),
  };
}

export async function validateOfferProductsPayload(body) {
  if (!Array.isArray(body?.items)) {
    return { error: "items must be an array." };
  }

  const normalized = [];
  const seenProductIds = new Set();
  for (const [index, item] of body.items.entries()) {
    const productId = cleanText(item?.productId);
    if (!productId) {
      return { error: `Offer product at index ${index} is missing productId.` };
    }

    if (seenProductIds.has(productId)) {
      return { error: `Duplicate product in offers payload: ${productId}.` };
    }

    const product = await findProductById(productId);
    if (!product) {
      return { error: `Offer product not found: ${productId}.` };
    }

    seenProductIds.add(productId);
    normalized.push({
      productId,
      badge: cleanText(item?.badge),
      subtitle: cleanText(item?.subtitle),
      isActive: typeof item?.isActive === "boolean" ? item.isActive : true,
    });
  }

  return { value: normalized };
}

export async function validateHomepageProductsPayload(body) {
  if (!body || typeof body !== "object") {
    return { error: "Payload is required." };
  }

  const sectionSource = body.section && typeof body.section === "object" ? body.section : body;
  const name = cleanText(sectionSource?.name || "Featured Products");
  const heading = cleanText(sectionSource?.heading || "Shop Featured Products");
  const sectionIsActive =
    typeof sectionSource?.isActive === "boolean" ? sectionSource.isActive : true;

  if (!name) {
    return { error: "Homepage product section name is required." };
  }
  if (!heading) {
    return { error: "Homepage product section heading is required." };
  }
  if (!Array.isArray(body.items)) {
    return { error: "items must be an array." };
  }
  if (body.items.length > 12) {
    return { error: "Homepage products can contain at most 12 products." };
  }

  const normalized = [];
  const seenProductIds = new Set();
  for (const [index, item] of body.items.entries()) {
    const productId = cleanText(item?.productId);
    if (!productId) {
      return { error: `Homepage product at index ${index} is missing productId.` };
    }

    if (seenProductIds.has(productId)) {
      return { error: `Duplicate product in homepage products payload: ${productId}.` };
    }

    const product = await findProductById(productId);
    if (!product) {
      return { error: `Homepage product not found: ${productId}.` };
    }

    seenProductIds.add(productId);
    normalized.push({
      productId,
      isActive: typeof item?.isActive === "boolean" ? item.isActive : true,
    });
  }

  return {
    value: {
      section: {
        name,
        heading,
        isActive: sectionIsActive,
      },
      items: normalized,
    },
  };
}

function normalizeOptionalDateValue(value) {
  const normalized = cleanText(value);
  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export async function validateComboOfferPayload(body, existingComboOffer) {
  const hasOwnField = (fieldName) => Object.prototype.hasOwnProperty.call(body ?? {}, fieldName);

  const title = cleanText(body?.title ?? existingComboOffer?.title);
  const bannerImageUrl = cleanText(
    hasOwnField("bannerImageUrl") ? body?.bannerImageUrl : existingComboOffer?.bannerImageUrl,
  );
  const bannerImageKey = cleanText(
    hasOwnField("bannerImageKey") ? body?.bannerImageKey : existingComboOffer?.bannerImageKey,
  );
  const description = cleanText(body?.description ?? existingComboOffer?.description);
  const offerPrice = toNumber(body?.offerPrice ?? existingComboOffer?.offerPrice);
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : existingComboOffer?.isActive ?? false;

  const startDateSource = hasOwnField("startDate") ? body?.startDate : existingComboOffer?.startDate;
  const endDateSource = hasOwnField("endDate") ? body?.endDate : existingComboOffer?.endDate;
  const startDate = normalizeOptionalDateValue(startDateSource);
  const endDate = normalizeOptionalDateValue(endDateSource);

  const productEntries = Array.isArray(body?.products)
    ? body.products
    : Array.isArray(body?.productIds)
      ? body.productIds.map((productId) => ({ productId }))
      : existingComboOffer?.products ?? [];

  if (!title) {
    return { error: "Offer title is required." };
  }
  if (!bannerImageUrl) {
    return { error: "Offer banner image is required." };
  }
  if (offerPrice === null || offerPrice <= 0) {
    return { error: "Offer price must be greater than zero." };
  }
  if (!Array.isArray(productEntries) || productEntries.length < 2 || productEntries.length > 3) {
    return { error: "Combo offer must contain 2 to 3 products." };
  }
  if (startDateSource && !startDate) {
    return { error: "Start date must be a valid date/time value." };
  }
  if (endDateSource && !endDate) {
    return { error: "End date must be a valid date/time value." };
  }
  if (startDate && endDate && new Date(endDate).getTime() < new Date(startDate).getTime()) {
    return { error: "End date must be later than start date." };
  }

  const normalizedProductIds = [];
  const seenProductIds = new Set();
  for (const [index, entry] of productEntries.entries()) {
    const productId = cleanText(entry?.productId ?? entry);
    if (!productId) {
      return { error: `Combo product at index ${index} is missing productId.` };
    }
    if (seenProductIds.has(productId)) {
      return { error: `Duplicate product in combo offer: ${productId}.` };
    }

    const product = await findProductById(productId);
    if (!product) {
      return { error: `Combo product not found: ${productId}.` };
    }

    seenProductIds.add(productId);
    normalizedProductIds.push(productId);
  }

  return {
    value: {
      title,
      bannerImageUrl,
      bannerImageKey,
      description,
      offerPrice,
      isActive,
      startDate,
      endDate,
      productIds: normalizedProductIds,
    },
  };
}

export async function validateBestSellerProductsPayload(body) {
  if (!Array.isArray(body?.items)) {
    return { error: "items must be an array." };
  }

  const normalized = [];
  const seenProductIds = new Set();
  for (const [index, item] of body.items.entries()) {
    const productId = cleanText(item?.productId);
    if (!productId) {
      return { error: `Best seller product at index ${index} is missing productId.` };
    }

    if (seenProductIds.has(productId)) {
      return { error: `Duplicate product in best sellers payload: ${productId}.` };
    }

    const product = await findProductById(productId);
    if (!product) {
      return { error: `Best seller product not found: ${productId}.` };
    }

    seenProductIds.add(productId);
    normalized.push({
      productId,
      isActive: typeof item?.isActive === "boolean" ? item.isActive : true,
    });
  }

  return { value: normalized };
}

export async function validateLabReportPayload(body, existingLabReport) {
  const hasOwnField = (fieldName) => Object.prototype.hasOwnProperty.call(body ?? {}, fieldName);

  const title = cleanText(body?.title ?? existingLabReport?.title);
  const description = cleanText(body?.description ?? existingLabReport?.description);
  const reportUrl = cleanText(hasOwnField("reportUrl") ? body?.reportUrl : existingLabReport?.reportUrl);
  const reportKeyCandidate = hasOwnField("reportKey")
    ? body?.reportKey
    : hasOwnField("reportUrl")
      ? ""
      : existingLabReport?.reportKey;
  const reportKey = resolveImageKeyFromPayload(reportKeyCandidate, reportUrl);
  const productId = cleanText(body?.productId ?? existingLabReport?.productId);
  const position = toNonNegativeInt(body?.position ?? existingLabReport?.position, existingLabReport?.position ?? 0);
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : existingLabReport?.isActive ?? true;

  if (!title) {
    return { error: "Lab report title is required." };
  }

  if (!reportUrl) {
    return { error: "Lab report URL is required." };
  }

  if (position === null) {
    return { error: "Lab report position must be a valid non-negative integer." };
  }

  if (productId) {
    const hasProduct = await findProductById(productId);
    if (!hasProduct) {
      return { error: "Linked product does not exist." };
    }
  }

  return {
    value: {
      title,
      description,
      reportUrl,
      reportKey,
      productId,
      position,
      isActive,
    },
  };
}

export async function validateCarouselImagePayload(body, existingCarouselImage) {
  const hasOwnField = (fieldName) => Object.prototype.hasOwnProperty.call(body ?? {}, fieldName);

  const title = cleanText(body?.title ?? existingCarouselImage?.title);
  const imageUrl = cleanText(hasOwnField("imageUrl") ? body?.imageUrl : existingCarouselImage?.imageUrl);
  const imageKeyCandidate = hasOwnField("imageKey")
    ? body?.imageKey
    : hasOwnField("imageUrl")
      ? ""
      : existingCarouselImage?.imageKey;
  const imageKey = resolveImageKeyFromPayload(imageKeyCandidate, imageUrl);
  const sortOrder = toNonNegativeInt(body?.sortOrder ?? existingCarouselImage?.sortOrder, existingCarouselImage?.sortOrder ?? 0);
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : existingCarouselImage?.isActive ?? true;

  // Optional linked product
  const linkedProductIdRaw = hasOwnField("linkedProductId")
    ? body?.linkedProductId
    : existingCarouselImage?.linkedProductId;
  const linkedProductId = cleanText(linkedProductIdRaw) || null;

  if (!imageUrl) {
    return { error: "Carousel image URL is required." };
  }

  if (imageKey && !imageUrl) {
    return { error: "Image URL is required when image key is provided." };
  }

  if (sortOrder === null) {
    return { error: "Sort order must be a valid non-negative integer." };
  }

  if (linkedProductId) {
    const hasProduct = await findProductById(linkedProductId);
    if (!hasProduct) {
      return { error: "Linked product does not exist." };
    }
  }

  return {
    value: {
      title,
      imageUrl,
      imageKey,
      linkedProductId,
      sortOrder,
      isActive,
    },
  };
}

export async function validateProductPayload(body, existingProduct) {
  const hasOwnField = (fieldName) => Object.prototype.hasOwnProperty.call(body ?? {}, fieldName);

  const name = cleanText(body?.name ?? existingProduct?.name);
  const description = cleanText(body?.description ?? existingProduct?.description);
  const sku = cleanText(body?.sku ?? existingProduct?.sku);
  const badge = cleanText(body?.badge ?? existingProduct?.badge);
  const subtitle = cleanText(body?.subtitle ?? existingProduct?.subtitle);
  const categoryId = cleanText(body?.categoryId ?? existingProduct?.categoryId);
  const offerPrice = toNumber(body?.offerPrice ?? body?.price ?? existingProduct?.offerPrice ?? existingProduct?.price);
  const originalPrice = toNumber(body?.originalPrice ?? existingProduct?.originalPrice ?? offerPrice);
  const stock = toNonNegativeInt(body?.stock ?? existingProduct?.stock, 0);
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : existingProduct?.isActive ?? true;

  let images = [];
  if (hasOwnField("images")) {
    const normalizedImages = normalizeProductImagesPayload(body?.images);
    if (!normalizedImages) {
      return { error: "Product images must be a valid list with image URL and optional image key/sort order." };
    }
    images = normalizedImages;
  } else if (hasOwnField("imageUrl") || hasOwnField("imageKey")) {
    const imageUrl = cleanText(body?.imageUrl);
    const imageKey = resolveImageKeyFromPayload(body?.imageKey, imageUrl);
    if (imageKey && !imageUrl) {
      return { error: "Image URL is required when image key is provided." };
    }
    images = imageUrl
      ? [
        {
          imageUrl,
          imageKey,
          sortOrder: 0,
        },
      ]
      : [];
  } else if (Array.isArray(existingProduct?.images) && existingProduct.images.length > 0) {
    images = existingProduct.images
      .map((image, index) => {
        const imageUrl = cleanText(image?.imageUrl);
        const imageKey = resolveImageKeyFromPayload(image?.imageKey, imageUrl);
        const sortOrder = toNonNegativeInt(image?.sortOrder, index);
        if (!imageUrl || sortOrder === null) {
          return null;
        }

        return {
          imageUrl,
          imageKey,
          sortOrder,
        };
      })
      .filter(Boolean);
  } else {
    const fallbackImageUrl = cleanText(existingProduct?.imageUrl);
    const fallbackImageKey = resolveImageKeyFromPayload(existingProduct?.imageKey, fallbackImageUrl);
    images = fallbackImageUrl
      ? [
        {
          imageUrl: fallbackImageUrl,
          imageKey: fallbackImageKey,
          sortOrder: 0,
        },
      ]
      : [];
  }

  const primaryImage = images[0] ?? { imageUrl: "", imageKey: "" };
  const imageUrl = primaryImage.imageUrl ?? "";
  const imageKey = primaryImage.imageKey ?? "";

  if (!name) {
    return { error: "Product name is required." };
  }

  if (!categoryId) {
    return { error: "Category is required." };
  }

  if (badge.length > 64) {
    return { error: "Badge cannot exceed 64 characters." };
  }

  if (subtitle.length > 191) {
    return { error: "Subtitle cannot exceed 191 characters." };
  }

  if (offerPrice === null || offerPrice < 0) {
    return { error: "Offer price must be a valid non-negative number." };
  }

  if (originalPrice === null || originalPrice < 0) {
    return { error: "Original price must be a valid non-negative number." };
  }

  if (originalPrice < offerPrice) {
    return { error: "Original price must be greater than or equal to offer price." };
  }

  if (stock === null) {
    return { error: "Stock must be a valid non-negative integer." };
  }

  const hasCategory = await categoryExists(categoryId);
  if (!hasCategory) {
    return { error: "Selected category does not exist." };
  }

  return {
    value: {
      name,
      description,
      imageUrl,
      imageKey,
      images,
      sku,
      badge,
      subtitle,
      categoryId,
      price: offerPrice,
      originalPrice,
      offerPrice,
      stock,
      isActive,
    },
  };
}

export function validateNavMenuMetaPayload(body, existingMenu) {
  const normalized = normalizeNavMenuMeta(
    {
      key: body?.key,
      name: body?.name,
      isActive: typeof body?.isActive === "boolean" ? body.isActive : existingMenu?.isActive,
    },
    existingMenu,
  );

  if (normalized.error) {
    return { error: normalized.error };
  }

  return { value: normalized.value };
}

export function validateNavMenuItemsPayload(body) {
  const normalized = normalizeNavMenuItems(body?.items);
  if (normalized.error) {
    return { error: normalized.error };
  }

  return { value: normalized.value };
}
