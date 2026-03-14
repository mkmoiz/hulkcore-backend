import { DEFAULT_THEME_SETTINGS, DEFAULT_EXTENDED_SETTINGS } from "../constants/theme.constants.js";
import { DEFAULT_HOME_CONTENT } from "../constants/home-content.constants.js";
import { toIsoString } from "../utils/dates.js";
import { normalizeHomeContentPayload } from "../utils/normalize.js";

export function mapThemeSettings(row) {
  if (!row) {
    return null;
  }

  let parsedExtended = {};
  if (typeof row.extendedSettings === "string" && row.extendedSettings.trim()) {
    try {
      parsedExtended = JSON.parse(row.extendedSettings);
    } catch {
      parsedExtended = {};
    }
  } else if (row.extendedSettings && typeof row.extendedSettings === "object") {
    parsedExtended = row.extendedSettings;
  }

  return {
    customerCode: row.customerCode || DEFAULT_THEME_SETTINGS.customerCode,
    brandName: row.brandName || DEFAULT_THEME_SETTINGS.brandName,
    themeMode: row.themeMode || DEFAULT_THEME_SETTINGS.themeMode,
    primaryColor: (row.primaryColor || DEFAULT_THEME_SETTINGS.primaryColor).toUpperCase(),
    primaryDarkColor: (row.primaryDarkColor || DEFAULT_THEME_SETTINGS.primaryDarkColor).toUpperCase(),
    primaryLightColor: (row.primaryLightColor || DEFAULT_THEME_SETTINGS.primaryLightColor).toUpperCase(),
    accentColor: (row.accentColor || DEFAULT_THEME_SETTINGS.accentColor).toUpperCase(),
    extendedSettings: { ...DEFAULT_EXTENDED_SETTINGS, ...parsedExtended },
    updatedAt: toIsoString(row.updatedAt),
  };
}

export function mapHomeContentRow(row) {
  if (!row) {
    return null;
  }

  let parsedPayload = null;
  if (typeof row.payload === "string" && row.payload.trim()) {
    try {
      parsedPayload = JSON.parse(row.payload);
    } catch {
      parsedPayload = null;
    }
  } else if (row.payload && typeof row.payload === "object") {
    parsedPayload = row.payload;
  }

  return {
    customerCode: row.customerCode || DEFAULT_HOME_CONTENT.customerCode,
    ...normalizeHomeContentPayload(parsedPayload),
    updatedAt: toIsoString(row.updatedAt),
  };
}
