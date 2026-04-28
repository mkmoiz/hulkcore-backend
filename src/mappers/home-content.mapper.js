import { toIsoString } from "../utils/dates.js";

export function mapHomeContent(row) {
  if (!row) {
    return null;
  }
  let content = {};
  try {
    content = typeof row.content_json === "string" ? JSON.parse(row.content_json) : (row.content_json || {});
  } catch (err) {
    console.error("Failed to parse home_content.content_json", err);
  }

  return {
    customerCode: row.customer_code,
    hero: content.hero || {},
    stats: Array.isArray(content.stats) ? content.stats : [],
    features: Array.isArray(content.features) ? content.features : [],
    benefits: Array.isArray(content.benefits) ? content.benefits : [],
    bundles: Array.isArray(content.bundles) ? content.bundles : [],
    reviews: Array.isArray(content.reviews) ? content.reviews : [],
    articles: Array.isArray(content.articles) ? content.articles : [],
    socialProof: content.socialProof || {},
    community: content.community || {},
    finalCta: content.finalCta || {},
    updatedAt: toIsoString(row.updated_at),
  };
}
