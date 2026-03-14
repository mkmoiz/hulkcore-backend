import { extractR2KeyFromImageUrl } from "../r2.js";
import { cleanText, toNonNegativeInt } from "../utils.js";
import { CUSTOMER_REF_PATTERN, LEVEL_SORT_MODES } from "../config/environment.js";

export function normalizePhoneNumber(value) {
  const raw = cleanText(value);
  if (!raw) {
    return "";
  }

  const withoutSeparators = raw.replace(/[\s-]+/g, "");
  const digits = withoutSeparators.replace(/[^\d]/g, "");

  if (!digits) {
    return "";
  }

  if (withoutSeparators.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  return "";
}

export function normalizeEmailAddress(value) {
  return cleanText(value).toLowerCase();
}

export function maskPhoneNumber(phoneNumber) {
  const digits = phoneNumber.replace(/[^\d]/g, "");
  if (digits.length <= 4) {
    return phoneNumber;
  }

  const visibleDigits = digits.slice(-4);
  return `+${"*".repeat(Math.max(0, digits.length - 4))}${visibleDigits}`;
}

export function maskEmailAddress(emailAddress) {
  const normalized = normalizeEmailAddress(emailAddress);
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0) {
    return normalized;
  }

  const localPart = normalized.slice(0, atIndex);
  const domainPart = normalized.slice(atIndex + 1);
  const maskedLocal = localPart.length <= 2 ? `${localPart.charAt(0) || ""}*` : `${localPart.slice(0, 2)}***`;
  const maskedDomain = domainPart.length <= 3 ? "***" : `${domainPart.slice(0, 2)}***`;
  return `${maskedLocal}@${maskedDomain}`;
}

export function resolveImageKeyFromPayload(imageKey, imageUrl) {
  const normalizedImageKey = cleanText(imageKey);
  if (normalizedImageKey) {
    return normalizedImageKey;
  }

  return extractR2KeyFromImageUrl(imageUrl);
}

export function normalizeProductImagesPayload(imagesValue) {
  if (!Array.isArray(imagesValue)) {
    return null;
  }

  const normalizedImages = [];
  for (const [index, image] of imagesValue.entries()) {
    const imageUrl = cleanText(image?.imageUrl);
    const imageKeyCandidate = cleanText(image?.imageKey);
    const imageKey = resolveImageKeyFromPayload(imageKeyCandidate, imageUrl);
    const sortOrderCandidate = toNonNegativeInt(image?.sortOrder, index);

    if (!imageUrl) {
      continue;
    }

    if (sortOrderCandidate === null) {
      return null;
    }

    normalizedImages.push({
      imageUrl,
      imageKey,
      sortOrder: sortOrderCandidate,
    });
  }

  normalizedImages.sort((a, b) => a.sortOrder - b.sortOrder);
  return normalizedImages;
}

export function collectImageKeysFromProduct(product) {
  const keySet = new Set();
  const primaryImageKey = resolveImageKeyFromPayload(product?.imageKey, product?.imageUrl);
  if (primaryImageKey) {
    keySet.add(primaryImageKey);
  }

  if (Array.isArray(product?.images)) {
    for (const image of product.images) {
      const imageKey = resolveImageKeyFromPayload(image?.imageKey, image?.imageUrl);
      if (imageKey) {
        keySet.add(imageKey);
      }
    }
  }

  return Array.from(keySet);
}

export function toProductStoreInput(product) {
  const images = Array.isArray(product.images)
    ? product.images
        .map((image, index) => ({
          imageUrl: cleanText(image?.imageUrl),
          imageKey: resolveImageKeyFromPayload(image?.imageKey, image?.imageUrl),
          sortOrder: toNonNegativeInt(image?.sortOrder, index) ?? index,
        }))
        .filter((image) => Boolean(image.imageUrl))
    : [];

  return {
    name: product.name,
    description: product.description ?? "",
    imageUrl: product.imageUrl ?? "",
    imageKey: product.imageKey ?? "",
    images,
    sku: product.sku ?? "",
    badge: product.badge ?? "",
    subtitle: product.subtitle ?? "",
    categoryId: product.categoryId,
    price: Number(product.offerPrice ?? product.price),
    originalPrice: Number(product.originalPrice ?? product.offerPrice ?? product.price),
    offerPrice: Number(product.offerPrice ?? product.price),
    stock: Number(product.stock),
    isActive: Boolean(product.isActive),
  };
}

export function toCategoryStoreInput(category) {
  return {
    name: category.name,
    slug: category.slug,
    description: category.description ?? "",
    imageUrl: category.imageUrl ?? "",
    imageKey: category.imageKey ?? "",
  };
}

export function toLabReportStoreInput(report) {
  return {
    title: report.title,
    description: report.description ?? "",
    reportUrl: report.reportUrl ?? "",
    reportKey: report.reportKey ?? "",
    productId: report.productId ?? "",
    position: Number(report.position ?? 0),
    isActive: Boolean(report.isActive),
  };
}

export function toCarouselStoreInput(carouselImage) {
  return {
    title: carouselImage.title ?? "",
    imageUrl: carouselImage.imageUrl ?? "",
    imageKey: carouselImage.imageKey ?? "",
    sortOrder: Number(carouselImage.sortOrder ?? 0),
    isActive: Boolean(carouselImage.isActive),
  };
}

export function normalizeCustomerRef(value) {
  const normalized = cleanText(value);
  if (!normalized) {
    return "";
  }

  return normalized;
}

export function resolveCustomerRef(req) {
  const fromBody = Array.isArray(req.body?.customerRef) ? req.body.customerRef[0] : req.body?.customerRef;
  const fromQuery = Array.isArray(req.query?.customerRef) ? req.query.customerRef[0] : req.query?.customerRef;
  const fromHeader = req.get("x-customer-ref");
  return normalizeCustomerRef(fromBody || fromQuery || fromHeader || "");
}

export function validateCustomerRef(customerRef) {
  if (!customerRef) {
    return false;
  }

  return CUSTOMER_REF_PATTERN.test(customerRef);
}

export function toNonNegativeQuantity(value, fallback = 1) {
  const quantity = toNonNegativeInt(value, fallback);
  if (quantity === null || quantity <= 0) {
    return null;
  }

  return quantity;
}

export function normalizeLevelSortMode(value, fallback = "featured") {
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (!LEVEL_SORT_MODES.has(normalized)) {
    return fallback;
  }

  return normalized;
}

export function parsePositiveInt(value, fallback) {
  const candidate = Number(value);
  if (!Number.isInteger(candidate) || candidate <= 0) {
    return fallback;
  }

  return candidate;
}

export function sortLevelEntries(entries, sortMode) {
  const copy = [...entries];
  switch (sortMode) {
    case "price_low_high":
      return copy.sort((a, b) => Number(a.product?.price ?? 0) - Number(b.product?.price ?? 0));
    case "price_high_low":
      return copy.sort((a, b) => Number(b.product?.price ?? 0) - Number(a.product?.price ?? 0));
    case "name_az":
      return copy.sort((a, b) => (a.product?.name ?? "").localeCompare(b.product?.name ?? ""));
    case "newest":
      return copy.sort((a, b) => {
        const left = new Date(a.product?.createdAt ?? 0).getTime();
        const right = new Date(b.product?.createdAt ?? 0).getTime();
        return right - left;
      });
    case "featured":
    default:
      return copy.sort((a, b) => {
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
          return a.isPinned ? -1 : 1;
        }
        return Number(a.position ?? 0) - Number(b.position ?? 0);
      });
  }
}

export function toPublicLevelShape(level, totalProducts) {
  return {
    id: level.id,
    slug: level.slug,
    name: level.name,
    description: level.description,
    imageUrl: level.imageUrl,
    imageKey: level.imageKey,
    position: level.position,
    isActive: level.isActive,
    ruleMode: level.ruleMode,
    sortMode: level.sortMode,
    includeCategoryIds: Array.isArray(level.includeCategoryIds) ? level.includeCategoryIds : [],
    productCount: Number(totalProducts ?? 0),
  };
}
