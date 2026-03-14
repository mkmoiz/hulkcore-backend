import { cleanText, toNonNegativeInt } from "../utils.js";

export const NAV_ITEM_TYPES = Object.freeze({
  LINK: "LINK",
  DROPDOWN: "DROPDOWN",
});

export const NAV_ITEM_TYPE_SET = new Set(Object.values(NAV_ITEM_TYPES));
export const NAV_TARGET_SET = new Set(["_self", "_blank"]);
export const NAV_MENU_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;

function toBoolean(value, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function normalizePosition(value, fallbackIndex) {
  const parsed = toNonNegativeInt(value, fallbackIndex);
  return parsed === null ? fallbackIndex : parsed;
}

function normalizeOrderedCollection(items, fallback) {
  return items
    .map((entry, index) => ({
      ...entry,
      position: normalizePosition(entry?.position, index),
      __index: index,
    }))
    .sort((a, b) => a.position - b.position || a.__index - b.__index)
    .map((entry, index) => fallback(entry, index));
}

function normalizeDropdownLink(rawLink, index) {
  const label = cleanText(rawLink?.label);
  const href = cleanText(rawLink?.href);

  if (!label) {
    return { error: `Dropdown link label is required at index ${index}.` };
  }

  if (!href) {
    return { error: `Dropdown link href is required for \"${label}\".` };
  }

  return {
    value: {
      id: cleanText(rawLink?.id),
      label,
      href,
      position: normalizePosition(rawLink?.position, index),
      badge: cleanText(rawLink?.badge),
      trackingTag: cleanText(rawLink?.trackingTag),
    },
  };
}

function normalizeDropdownGroup(rawGroup, index, itemLabel) {
  const linksSource = Array.isArray(rawGroup?.links) ? rawGroup.links : [];
  const normalizedLinks = [];

  for (const [linkIndex, rawLink] of linksSource.entries()) {
    const normalizedLink = normalizeDropdownLink(rawLink, linkIndex);
    if (normalizedLink.error) {
      return { error: `${normalizedLink.error} (dropdown item: \"${itemLabel}\")` };
    }

    normalizedLinks.push(normalizedLink.value);
  }

  if (normalizedLinks.length === 0) {
    return { error: `Dropdown group at index ${index} must include at least one link.` };
  }

  return {
    value: {
      id: cleanText(rawGroup?.id),
      title: cleanText(rawGroup?.title),
      position: normalizePosition(rawGroup?.position, index),
      links: normalizeOrderedCollection(normalizedLinks, (link, normalizedIndex) => ({
        id: link.id,
        label: link.label,
        href: link.href,
        position: normalizedIndex,
        badge: link.badge,
        trackingTag: link.trackingTag,
      })),
    },
  };
}

function normalizePromoTile(rawTile, index, itemLabel) {
  const imageUrl = cleanText(rawTile?.imageUrl);
  const href = cleanText(rawTile?.href);
  const title = cleanText(rawTile?.title);
  const subtitle = cleanText(rawTile?.subtitle);

  const hasAnyValue = Boolean(imageUrl || href || title || subtitle);
  if (!hasAnyValue) {
    return { value: null };
  }

  if (!imageUrl) {
    return { error: `Promo tile imageUrl is required at index ${index} (dropdown item: \"${itemLabel}\").` };
  }

  if (!href) {
    return { error: `Promo tile href is required at index ${index} (dropdown item: \"${itemLabel}\").` };
  }

  return {
    value: {
      id: cleanText(rawTile?.id),
      imageUrl,
      title,
      subtitle,
      href,
      position: normalizePosition(rawTile?.position, index),
    },
  };
}

function normalizeNavItem(rawItem, index) {
  const label = cleanText(rawItem?.label);
  if (!label) {
    return { error: `Navigation item label is required at index ${index}.` };
  }

  const rawType = cleanText(rawItem?.type).toUpperCase();
  if (!NAV_ITEM_TYPE_SET.has(rawType)) {
    return { error: `Navigation item type must be LINK or DROPDOWN for \"${label}\".` };
  }

  const target = cleanText(rawItem?.target) || "_self";
  if (!NAV_TARGET_SET.has(target)) {
    return { error: `Navigation target must be _self or _blank for \"${label}\".` };
  }

  const itemBase = {
    id: cleanText(rawItem?.id),
    label,
    type: rawType,
    href: cleanText(rawItem?.href),
    target,
    position: normalizePosition(rawItem?.position, index),
    isVisible: toBoolean(rawItem?.isVisible, true),
    icon: cleanText(rawItem?.icon),
    dropdownGroups: [],
    promoTiles: [],
  };

  if (rawType === NAV_ITEM_TYPES.LINK) {
    if (!itemBase.href) {
      return { error: `href is required for LINK item \"${label}\".` };
    }

    return { value: itemBase };
  }

  const groupsSource = Array.isArray(rawItem?.dropdownGroups)
    ? rawItem.dropdownGroups
    : Array.isArray(rawItem?.groups)
      ? rawItem.groups
      : [];

  const normalizedGroups = [];
  for (const [groupIndex, rawGroup] of groupsSource.entries()) {
    const normalizedGroup = normalizeDropdownGroup(rawGroup, groupIndex, label);
    if (normalizedGroup.error) {
      return { error: normalizedGroup.error };
    }

    normalizedGroups.push(normalizedGroup.value);
  }

  if (normalizedGroups.length === 0) {
    return { error: `Dropdown item \"${label}\" must have at least one group and one link.` };
  }

  const promoTilesSource = Array.isArray(rawItem?.promoTiles) ? rawItem.promoTiles : [];
  const normalizedPromoTiles = [];
  for (const [tileIndex, rawTile] of promoTilesSource.entries()) {
    const normalizedTile = normalizePromoTile(rawTile, tileIndex, label);
    if (normalizedTile.error) {
      return { error: normalizedTile.error };
    }

    if (normalizedTile.value) {
      normalizedPromoTiles.push(normalizedTile.value);
    }
  }

  return {
    value: {
      ...itemBase,
      href: itemBase.href || "",
      dropdownGroups: normalizeOrderedCollection(normalizedGroups, (group, normalizedIndex) => ({
        id: group.id,
        title: group.title,
        position: normalizedIndex,
        links: group.links,
      })),
      promoTiles: normalizeOrderedCollection(normalizedPromoTiles, (tile, normalizedIndex) => ({
        id: tile.id,
        imageUrl: tile.imageUrl,
        title: tile.title,
        subtitle: tile.subtitle,
        href: tile.href,
        position: normalizedIndex,
      })),
    },
  };
}

export function normalizeNavMenuItems(rawItems) {
  if (!Array.isArray(rawItems)) {
    return { error: "items must be an array." };
  }

  if (rawItems.length === 0) {
    return { error: "At least one navigation item is required." };
  }

  const normalized = [];
  for (const [index, rawItem] of rawItems.entries()) {
    const normalizedItem = normalizeNavItem(rawItem, index);
    if (normalizedItem.error) {
      return { error: normalizedItem.error };
    }

    normalized.push(normalizedItem.value);
  }

  return {
    value: normalizeOrderedCollection(normalized, (item, normalizedIndex) => ({
      ...item,
      position: normalizedIndex,
    })),
  };
}

export function normalizeNavMenuMeta(input, existingMeta = {}) {
  const key = cleanText(input?.key ?? existingMeta?.key).toLowerCase();
  const name = cleanText(input?.name ?? existingMeta?.name);
  const isActive = typeof input?.isActive === "boolean" ? input.isActive : Boolean(existingMeta?.isActive ?? true);

  if (!key) {
    return { error: "Menu key is required." };
  }

  if (!NAV_MENU_KEY_PATTERN.test(key)) {
    return {
      error:
        "Menu key must be 2-64 chars using lowercase letters, numbers, underscore, or hyphen.",
    };
  }

  if (!name) {
    return { error: "Menu name is required." };
  }

  return {
    value: {
      key,
      name,
      isActive,
    },
  };
}

export function filterVisibleNavItems(items) {
  const source = Array.isArray(items) ? items : [];

  return source
    .filter((item) => item?.isVisible)
    .map((item) => ({
      id: item.id,
      label: item.label,
      type: item.type,
      href: item.href,
      target: item.target,
      position: Number(item.position ?? 0),
      isVisible: true,
      icon: item.icon || "",
      dropdownGroups:
        item.type === NAV_ITEM_TYPES.DROPDOWN
          ? (item.dropdownGroups ?? []).map((group) => ({
              id: group.id,
              title: group.title,
              position: Number(group.position ?? 0),
              links: (group.links ?? []).map((link) => ({
                id: link.id,
                label: link.label,
                href: link.href,
                position: Number(link.position ?? 0),
                badge: link.badge || "",
                trackingTag: link.trackingTag || "",
              })),
            }))
          : [],
      promoTiles:
        item.type === NAV_ITEM_TYPES.DROPDOWN
          ? (item.promoTiles ?? []).map((tile) => ({
              id: tile.id,
              imageUrl: tile.imageUrl,
              title: tile.title || "",
              subtitle: tile.subtitle || "",
              href: tile.href,
              position: Number(tile.position ?? 0),
            }))
          : [],
    }))
    .sort((a, b) => a.position - b.position);
}

export function buildPublishedNavMenu(menuMeta, draftItems, publishedAtIso) {
  return {
    id: menuMeta.id,
    key: menuMeta.key,
    name: menuMeta.name,
    isActive: Boolean(menuMeta.isActive),
    version: Number(menuMeta.version ?? 0),
    publishedAt: publishedAtIso,
    updatedAt: menuMeta.updatedAt,
    items: filterVisibleNavItems(draftItems),
  };
}
