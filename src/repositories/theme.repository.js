import { getPool } from "../db/connection.js";
import { mapThemeSettings } from "../mappers/theme.mapper.js";
import { normalizeCustomerCode } from "../utils/normalize.js";

export async function findThemeSettingsByCode(customerCode) {
  const normalizedCode = normalizeCustomerCode(customerCode);
  const [rows] = await getPool().query(
    `
      SELECT
        customer_code AS customerCode,
        brand_name AS brandName,
        theme_mode AS themeMode,
        primary_color AS primaryColor,
        primary_dark_color AS primaryDarkColor,
        primary_light_color AS primaryLightColor,
        accent_color AS accentColor,
        extended_settings AS extendedSettings,
        updated_at AS updatedAt
      FROM theme_settings
      WHERE customer_code = ?
      LIMIT 1
    `,
    [normalizedCode],
  );

  return mapThemeSettings(rows[0]);
}

export async function upsertThemeSettingsRow(input) {
  const now = new Date();
  const customerCode = normalizeCustomerCode(input?.customerCode);

  const extendedSettingsJson = input.extendedSettings
    ? JSON.stringify(input.extendedSettings)
    : null;

  await getPool().query(
    `
      INSERT INTO theme_settings (
        customer_code,
        brand_name,
        theme_mode,
        primary_color,
        primary_dark_color,
        primary_light_color,
        accent_color,
        extended_settings,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        brand_name = VALUES(brand_name),
        theme_mode = VALUES(theme_mode),
        primary_color = VALUES(primary_color),
        primary_dark_color = VALUES(primary_dark_color),
        primary_light_color = VALUES(primary_light_color),
        accent_color = VALUES(accent_color),
        extended_settings = VALUES(extended_settings),
        updated_at = VALUES(updated_at)
    `,
    [
      customerCode,
      input.brandName,
      input.themeMode,
      input.primaryColor,
      input.primaryDarkColor,
      input.primaryLightColor,
      input.accentColor,
      extendedSettingsJson,
      now,
    ],
  );

  return findThemeSettingsByCode(customerCode);
}
