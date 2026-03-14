const DEFAULT_HOME_CONTENT_PAYLOAD = Object.freeze({
  hero: {
    eyebrow: "",
    headline: "",
    description: "",
  },
  stats: [],
  features: [],
  benefits: [],
  bundles: [],
  reviews: [],
  articles: [],
  socialProof: {
    eyebrow: "",
    headline: "",
    ratingText: "",
    logos: [],
  },
  community: {
    eyebrow: "",
    title: "",
    subtitle: "",
  },
  finalCta: {
    eyebrow: "",
    headline: "",
    description: "",
    ctaLabel: "",
    ctaHref: "",
    badge: "",
  },
});

export { DEFAULT_HOME_CONTENT_PAYLOAD };

export const DEFAULT_HOME_CONTENT = Object.freeze({
  customerCode: "default",
  ...DEFAULT_HOME_CONTENT_PAYLOAD,
});
