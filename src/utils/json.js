import { normalizeText } from "./normalize.js";

export function parseJsonStringArray(value) {
  if (!value || typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => normalizeText(entry))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function parsePublishedNavPayload(publishedPayload) {
  if (!publishedPayload || typeof publishedPayload !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(publishedPayload);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
