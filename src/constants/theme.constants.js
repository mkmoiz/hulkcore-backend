export const DEFAULT_EXTENDED_SETTINGS = Object.freeze({
  // ─── Typography ───
  fontHeading: "Inter, system-ui, sans-serif",
  fontBody: "Inter, system-ui, sans-serif",
  fontMono: "JetBrains Mono, monospace",
  headingWeight: "800",
  headingLetterSpacing: "-0.03em",
  bodyFontSize: "16px",
  bodyLineHeight: "1.6",
  h1Size: "3.5rem",
  h2Size: "2.25rem",
  h3Size: "1.5rem",
  smallSize: "0.875rem",
  // ─── Text Colors (overrides) ───
  textHeadingColor: "",  // empty = use theme-text-strong
  textBodyColor: "",     // empty = use theme-text-soft
  textLinkColor: "",     // empty = use primaryLight
  textLinkHoverColor: "", // empty = use primary
  // ─── Buttons ───
  buttonRadius: "12px",
  buttonPaddingX: "24px",
  buttonPaddingY: "12px",
  buttonFontWeight: "700",
  buttonFontSize: "0.875rem",
  buttonTextTransform: "none",
  buttonShadow: "0 2px 12px rgba(0,0,0,0.15)",
  buttonHoverScale: "1.02",
  // ─── Layout / Cards ───
  cardRadius: "16px",
  cardShadow: "0 8px 32px rgba(0,0,0,0.2)",
  cardBorderWidth: "1px",
  containerMaxWidth: "1280px",
  sectionSpacing: "80px",
  gridGap: "24px",
  // ─── Backgrounds ───
  bgBaseColor: "",       // empty = use mode defaults
  bgElevatedColor: "",
  bgGlassOpacity: "0.6",
  bgGlassBlur: "16px",
  // ─── Borders ───
  borderSubtleColor: "",
  borderStrongColor: "",
  borderDefaultWidth: "1px",
  // ─── Misc ───
  navHeight: "72px",
  navBlur: "12px",
  badgeRadius: "999px",
  badgeFontSize: "0.75rem",
  badgePaddingX: "12px",
  badgePaddingY: "4px",
  inputRadius: "10px",
  inputPaddingX: "16px",
  inputPaddingY: "12px",
  inputBorderColor: "",
  focusRingColor: "",
  focusRingWidth: "3px",
});

export const DEFAULT_THEME_SETTINGS = Object.freeze({
  customerCode: "default",
  brandName: "Hulk Core",
  themeMode: "night",
  primaryColor: "#4CAF50",
  primaryDarkColor: "#2E7D32",
  primaryLightColor: "#81C784",
  accentColor: "#A3FF12",
  extendedSettings: { ...DEFAULT_EXTENDED_SETTINGS },
});
