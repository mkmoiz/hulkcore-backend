import { toIsoString } from "../utils/dates.js";

export function mapNavMenu(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    key: row.key,
    name: row.name,
    isActive: Boolean(row.isActive),
    version: Number(row.version ?? 0),
    publishedAt: row.publishedAt ? toIsoString(row.publishedAt) : null,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export function mapNavItem(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    menuId: row.menuId,
    label: row.label,
    type: row.type,
    href: row.href ?? "",
    target: row.target ?? "_self",
    position: Number(row.position ?? 0),
    isVisible: Boolean(row.isVisible),
    icon: row.icon ?? "",
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    dropdownGroups: [],
    promoTiles: [],
  };
}

export function mapDropdownGroup(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    navItemId: row.navItemId,
    title: row.title ?? "",
    position: Number(row.position ?? 0),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    links: [],
  };
}

export function mapDropdownLink(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    groupId: row.groupId,
    label: row.label,
    href: row.href,
    position: Number(row.position ?? 0),
    badge: row.badge ?? "",
    trackingTag: row.trackingTag ?? "",
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export function mapPromoTile(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    navItemId: row.navItemId,
    imageUrl: row.imageUrl,
    title: row.title ?? "",
    subtitle: row.subtitle ?? "",
    href: row.href,
    position: Number(row.position ?? 0),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}
