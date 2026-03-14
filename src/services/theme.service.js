import { DEFAULT_HOME_CONTENT } from "../constants/home-content.constants.js";
import { DEFAULT_THEME_SETTINGS } from "../constants/theme.constants.js";
import { findThemeSettingsByCode, upsertThemeSettingsRow } from "../repositories/theme.repository.js";
import { findHomeContentByCode, upsertHomeContentRow } from "../repositories/home-content.repository.js";
import {
  cloneDefaultHomeContentPayload,
  normalizeCustomerCode,
  normalizeHomeContentPayload,
} from "../utils/normalize.js";

export async function getThemeSettings(customerCode = DEFAULT_THEME_SETTINGS.customerCode) {
  const normalizedCode = normalizeCustomerCode(customerCode);

  const customerTheme = await findThemeSettingsByCode(normalizedCode);
  if (customerTheme) {
    return customerTheme;
  }

  const defaultTheme = await findThemeSettingsByCode(DEFAULT_THEME_SETTINGS.customerCode);
  if (defaultTheme) {
    return defaultTheme;
  }

  await upsertThemeSettings(DEFAULT_THEME_SETTINGS);
  const reloadedDefaultTheme = await findThemeSettingsByCode(DEFAULT_THEME_SETTINGS.customerCode);
  if (reloadedDefaultTheme) {
    return reloadedDefaultTheme;
  }

  return {
    ...DEFAULT_THEME_SETTINGS,
    updatedAt: new Date().toISOString(),
  };
}

export async function upsertThemeSettings(input) {
  return upsertThemeSettingsRow({
    customerCode: normalizeCustomerCode(input?.customerCode),
    brandName: input?.brandName ?? DEFAULT_THEME_SETTINGS.brandName,
    themeMode: input?.themeMode ?? DEFAULT_THEME_SETTINGS.themeMode,
    primaryColor: input?.primaryColor ?? DEFAULT_THEME_SETTINGS.primaryColor,
    primaryDarkColor: input?.primaryDarkColor ?? DEFAULT_THEME_SETTINGS.primaryDarkColor,
    primaryLightColor: input?.primaryLightColor ?? DEFAULT_THEME_SETTINGS.primaryLightColor,
    accentColor: input?.accentColor ?? DEFAULT_THEME_SETTINGS.accentColor,
    extendedSettings: input?.extendedSettings ?? DEFAULT_THEME_SETTINGS.extendedSettings ?? {},
  });
}

export async function getHomeContent(customerCode = DEFAULT_HOME_CONTENT.customerCode) {
  const normalizedCode = normalizeCustomerCode(customerCode);

  const customerHomeContent = await findHomeContentByCode(normalizedCode);
  if (customerHomeContent) {
    return customerHomeContent;
  }

  const defaultHomeContent = await findHomeContentByCode(DEFAULT_HOME_CONTENT.customerCode);
  if (defaultHomeContent) {
    return defaultHomeContent;
  }

  await upsertHomeContent({
    customerCode: DEFAULT_HOME_CONTENT.customerCode,
    ...cloneDefaultHomeContentPayload(),
  });
  const reloadedDefaultHomeContent = await findHomeContentByCode(DEFAULT_HOME_CONTENT.customerCode);
  if (reloadedDefaultHomeContent) {
    return reloadedDefaultHomeContent;
  }

  return {
    customerCode: DEFAULT_HOME_CONTENT.customerCode,
    ...cloneDefaultHomeContentPayload(),
    updatedAt: new Date().toISOString(),
  };
}

export async function upsertHomeContent(input) {
  const normalizedPayload = normalizeHomeContentPayload(input);
  return upsertHomeContentRow(
    { customerCode: normalizeCustomerCode(input?.customerCode) },
    normalizedPayload,
  );
}

export async function ensureDefaultThemeSettingsRow() {
  const existingDefaultTheme = await findThemeSettingsByCode(DEFAULT_THEME_SETTINGS.customerCode);
  if (existingDefaultTheme) {
    return;
  }

  await upsertThemeSettings(DEFAULT_THEME_SETTINGS);
}

export async function ensureDefaultHomeContentRow() {
  const existingDefaultHomeContent = await findHomeContentByCode(DEFAULT_HOME_CONTENT.customerCode);
  if (existingDefaultHomeContent) {
    return;
  }

  await upsertHomeContent({
    customerCode: DEFAULT_HOME_CONTENT.customerCode,
    ...cloneDefaultHomeContentPayload(),
  });
}
