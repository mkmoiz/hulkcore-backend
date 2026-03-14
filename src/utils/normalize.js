import { DEFAULT_THEME_SETTINGS } from "../constants/theme.constants.js";
import { DEFAULT_HOME_CONTENT_PAYLOAD } from "../constants/home-content.constants.js";

export function normalizeText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim();
}

export function parsePositiveInt(value, fallback) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return fallback;
  }

  return num;
}

export function normalizeCustomerCode(customerCode) {
  if (typeof customerCode !== "string") {
    return DEFAULT_THEME_SETTINGS.customerCode;
  }

  const normalized = customerCode.trim().toLowerCase();
  return normalized || DEFAULT_THEME_SETTINGS.customerCode;
}

export function normalizeCustomerRef(customerRef) {
  if (typeof customerRef !== "string") {
    return "";
  }

  return customerRef.trim();
}

export function normalizePhone(phone) {
  if (typeof phone !== "string") {
    return "";
  }

  return phone.trim();
}

export function normalizeEmail(email) {
  if (typeof email !== "string") {
    return "";
  }

  return email.trim().toLowerCase();
}

export function normalizeProductImageList(images, fallbackImageUrl = "", fallbackImageKey = "") {
  const normalized = Array.isArray(images)
    ? images
        .map((image, index) => {
          const imageUrl = normalizeText(image?.imageUrl);
          const imageKey = normalizeText(image?.imageKey);
          const sortOrderCandidate = Number(image?.sortOrder);
          const sortOrder =
            Number.isInteger(sortOrderCandidate) && sortOrderCandidate >= 0 ? sortOrderCandidate : index;

          if (!imageUrl) {
            return null;
          }

          return {
            imageUrl,
            imageKey,
            sortOrder,
          };
        })
        .filter(Boolean)
    : [];

  if (normalized.length > 0) {
    return normalized.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const fallbackUrl = normalizeText(fallbackImageUrl);
  if (!fallbackUrl) {
    return [];
  }

  return [
    {
      imageUrl: fallbackUrl,
      imageKey: normalizeText(fallbackImageKey),
      sortOrder: 0,
    },
  ];
}

export function cloneDefaultHomeContentPayload() {
  return JSON.parse(JSON.stringify(DEFAULT_HOME_CONTENT_PAYLOAD));
}

export function normalizeIconKey(value, fallback) {
  const normalized = normalizeText(value, fallback).toLowerCase();
  return normalized || fallback;
}

export function normalizeStringList(values, maxItems) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function normalizeHomeContentPayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const heroSource = source.hero && typeof source.hero === "object" ? source.hero : {};
  const socialProofSource = source.socialProof && typeof source.socialProof === "object" ? source.socialProof : {};
  const communitySource = source.community && typeof source.community === "object" ? source.community : {};
  const finalCtaSource = source.finalCta && typeof source.finalCta === "object" ? source.finalCta : {};

  const hero = {
    eyebrow: normalizeText(heroSource.eyebrow, ""),
    headline: normalizeText(heroSource.headline, ""),
    description: normalizeText(heroSource.description, ""),
  };

  const stats = Array.isArray(source.stats)
    ? source.stats
        .map((entry) => {
          return {
            value: normalizeText(entry?.value, ""),
            label: normalizeText(entry?.label, ""),
            iconKey: normalizeIconKey(entry?.iconKey, "shield"),
          };
        })
        .filter((entry) => entry.value && entry.label)
        .slice(0, 12)
    : [];

  const features = Array.isArray(source.features)
    ? source.features
        .map((entry) => {
          return {
            title: normalizeText(entry?.title, ""),
            description: normalizeText(entry?.description, ""),
            iconKey: normalizeIconKey(entry?.iconKey, "shield"),
          };
        })
        .filter((entry) => entry.title)
        .slice(0, 16)
    : [];

  const benefits = Array.isArray(source.benefits)
    ? source.benefits
        .map((entry) => {
          return {
            title: normalizeText(entry?.title, ""),
            description: normalizeText(entry?.description, ""),
            iconKey: normalizeIconKey(entry?.iconKey, "shield"),
          };
        })
        .filter((entry) => entry.title)
        .slice(0, 16)
    : [];

  const bundles = Array.isArray(source.bundles)
    ? source.bundles
        .map((entry) => {
          return {
            name: normalizeText(entry?.name, ""),
            description: normalizeText(entry?.description, ""),
            items: normalizeStringList(entry?.items, 12),
            saveLabel: normalizeText(entry?.saveLabel, ""),
            cta: normalizeText(entry?.cta, ""),
          };
        })
        .filter((entry) => entry.name)
        .slice(0, 16)
    : [];

  const reviews = Array.isArray(source.reviews)
    ? source.reviews
        .map((entry) => {
          return {
            name: normalizeText(entry?.name, ""),
            goal: normalizeText(entry?.goal, ""),
            quote: normalizeText(entry?.quote, ""),
            rating: normalizeText(entry?.rating, ""),
          };
        })
        .filter((entry) => entry.name && entry.quote)
        .slice(0, 24)
    : [];

  const articles = Array.isArray(source.articles)
    ? source.articles
        .map((entry) => {
          return {
            title: normalizeText(entry?.title, ""),
            summary: normalizeText(entry?.summary, ""),
            tag: normalizeText(entry?.tag, ""),
            readTime: normalizeText(entry?.readTime, ""),
          };
        })
        .filter((entry) => entry.title)
        .slice(0, 24)
    : [];

  const socialProof = {
    eyebrow: normalizeText(socialProofSource.eyebrow, ""),
    headline: normalizeText(socialProofSource.headline, ""),
    ratingText: normalizeText(socialProofSource.ratingText, ""),
    logos: normalizeStringList(socialProofSource.logos, 8),
  };

  const community = {
    eyebrow: normalizeText(communitySource.eyebrow, ""),
    title: normalizeText(communitySource.title, ""),
    subtitle: normalizeText(communitySource.subtitle, ""),
  };

  const finalCta = {
    eyebrow: normalizeText(finalCtaSource.eyebrow, ""),
    headline: normalizeText(finalCtaSource.headline, ""),
    description: normalizeText(finalCtaSource.description, ""),
    ctaLabel: normalizeText(finalCtaSource.ctaLabel, ""),
    ctaHref: normalizeText(finalCtaSource.ctaHref, ""),
    badge: normalizeText(finalCtaSource.badge, ""),
  };

  return {
    hero,
    stats,
    features,
    benefits,
    bundles,
    reviews,
    articles,
    socialProof,
    community,
    finalCta,
  };
}

export function normalizeNavMenuKey(key) {
  return normalizeText(key).toLowerCase();
}

export function normalizeNavMenuName(name) {
  return normalizeText(name);
}

export function normalizeIdArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeText(value))
    .filter(Boolean);
}
