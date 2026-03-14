import { getPool } from "../db/connection.js";
import {
  mapDropdownGroup,
  mapDropdownLink,
  mapNavItem,
  mapNavMenu,
  mapPromoTile,
} from "../mappers/nav.mapper.js";
import { normalizeNavMenuKey } from "../utils/normalize.js";

export async function findNavMenuRowById(menuId, connection = getPool()) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        menu_key AS \`key\`,
        name,
        is_active AS isActive,
        version,
        published_payload AS publishedPayload,
        published_at AS publishedAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM nav_menus
      WHERE id = ?
      LIMIT 1
    `,
    [menuId],
  );

  return rows[0] ?? null;
}

export async function findNavMenuRowByKey(menuKey, connection = getPool()) {
  const normalizedKey = normalizeNavMenuKey(menuKey);
  const [rows] = await connection.query(
    `
      SELECT
        id,
        menu_key AS \`key\`,
        name,
        is_active AS isActive,
        version,
        published_payload AS publishedPayload,
        published_at AS publishedAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM nav_menus
      WHERE menu_key = ?
      LIMIT 1
    `,
    [normalizedKey],
  );

  return rows[0] ?? null;
}

export async function getNavMenus() {
  const [rows] = await getPool().query(
    `
      SELECT
        id,
        menu_key AS \`key\`,
        name,
        is_active AS isActive,
        version,
        published_at AS publishedAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM nav_menus
      ORDER BY updated_at DESC
    `,
  );

  return rows.map(mapNavMenu);
}

export async function findNavMenuById(menuId) {
  const row = await findNavMenuRowById(menuId);
  return mapNavMenu(row);
}

export async function findNavMenuByKey(menuKey) {
  const row = await findNavMenuRowByKey(menuKey);
  return mapNavMenu(row);
}

export async function findNavItemRowsByMenuId(menuId, connection = getPool()) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        menu_id AS menuId,
        label,
        item_type AS type,
        href,
        target,
        position,
        is_visible AS isVisible,
        icon,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM nav_items
      WHERE menu_id = ?
      ORDER BY position ASC, created_at ASC
    `,
    [menuId],
  );

  return rows;
}

export async function findDropdownGroupRowsByItemIds(itemIds, connection = getPool()) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return [];
  }

  const [rows] = await connection.query(
    `
      SELECT
        id,
        nav_item_id AS navItemId,
        title,
        position,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM nav_dropdown_groups
      WHERE nav_item_id IN (?)
      ORDER BY position ASC, created_at ASC
    `,
    [itemIds],
  );

  return rows;
}

export async function findDropdownLinkRowsByGroupIds(groupIds, connection = getPool()) {
  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    return [];
  }

  const [rows] = await connection.query(
    `
      SELECT
        id,
        group_id AS groupId,
        label,
        href,
        position,
        badge,
        tracking_tag AS trackingTag,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM nav_dropdown_links
      WHERE group_id IN (?)
      ORDER BY position ASC, created_at ASC
    `,
    [groupIds],
  );

  return rows;
}

export async function findPromoTileRowsByItemIds(itemIds, connection = getPool()) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return [];
  }

  const [rows] = await connection.query(
    `
      SELECT
        id,
        nav_item_id AS navItemId,
        image_url AS imageUrl,
        title,
        subtitle,
        href,
        position,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM nav_promo_tiles
      WHERE nav_item_id IN (?)
      ORDER BY position ASC, created_at ASC
    `,
    [itemIds],
  );

  return rows;
}

export async function loadNavItemsByMenuId(menuId, connection = getPool()) {
  const itemRows = await findNavItemRowsByMenuId(menuId, connection);
  if (itemRows.length === 0) {
    return [];
  }

  const mappedItems = itemRows.map(mapNavItem).filter(Boolean);
  const itemMap = new Map(mappedItems.map((item) => [item.id, item]));
  const itemIds = mappedItems.map((item) => item.id);

  const groupRows = await findDropdownGroupRowsByItemIds(itemIds, connection);
  const mappedGroups = groupRows.map(mapDropdownGroup).filter(Boolean);
  const groupMap = new Map(mappedGroups.map((group) => [group.id, group]));
  for (const group of mappedGroups) {
    const parentItem = itemMap.get(group.navItemId);
    if (parentItem) {
      parentItem.dropdownGroups.push(group);
    }
  }

  const groupIds = mappedGroups.map((group) => group.id);
  const linkRows = await findDropdownLinkRowsByGroupIds(groupIds, connection);
  for (const linkRow of linkRows) {
    const link = mapDropdownLink(linkRow);
    if (!link) {
      continue;
    }

    const parentGroup = groupMap.get(link.groupId);
    if (parentGroup) {
      parentGroup.links.push(link);
    }
  }

  const promoTileRows = await findPromoTileRowsByItemIds(itemIds, connection);
  for (const promoTileRow of promoTileRows) {
    const tile = mapPromoTile(promoTileRow);
    if (!tile) {
      continue;
    }

    const parentItem = itemMap.get(tile.navItemId);
    if (parentItem) {
      parentItem.promoTiles.push(tile);
    }
  }

  for (const item of mappedItems) {
    item.dropdownGroups = item.dropdownGroups
      .sort((a, b) => a.position - b.position)
      .map((group, groupIndex) => ({
        ...group,
        position: groupIndex,
        links: group.links
          .sort((a, b) => a.position - b.position)
          .map((link, linkIndex) => ({
            ...link,
            position: linkIndex,
          })),
      }));

    item.promoTiles = item.promoTiles
      .sort((a, b) => a.position - b.position)
      .map((tile, tileIndex) => ({
        ...tile,
        position: tileIndex,
      }));
  }

  return mappedItems
    .sort((a, b) => a.position - b.position)
    .map((item, index) => ({
      ...item,
      position: index,
    }));
}

export async function createNavMenuRow(input) {
  const now = new Date();

  await getPool().query(
    `
      INSERT INTO nav_menus (
        id,
        menu_key,
        name,
        is_active,
        version,
        published_payload,
        published_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, 0, NULL, NULL, ?, ?)
    `,
    [input.id, input.key, input.name, input.isActive ? 1 : 0, now, now],
  );

  return findNavMenuRowById(input.id);
}

export async function updateNavMenuMetaRowById(menuId, input) {
  const now = new Date();
  const [result] = await getPool().query(
    `
      UPDATE nav_menus
      SET
        menu_key = ?,
        name = ?,
        is_active = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [input.key, input.name, input.isActive ? 1 : 0, now, menuId],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findNavMenuRowById(menuId);
}

export async function deleteNavItemsByMenuId(menuId, connection = getPool()) {
  await connection.query(
    `
      DELETE FROM nav_items
      WHERE menu_id = ?
    `,
    [menuId],
  );
}

export async function insertNavItemRow(menuId, item, index, now, connection = getPool()) {
  await connection.query(
    `
      INSERT INTO nav_items (
        id,
        menu_id,
        label,
        item_type,
        href,
        target,
        position,
        is_visible,
        icon,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      item.id,
      menuId,
      item.label,
      item.type,
      item.href,
      item.target,
      index,
      item.isVisible ? 1 : 0,
      item.icon,
      now,
      now,
    ],
  );
}

export async function insertNavDropdownGroupRow(itemId, group, index, now, connection = getPool()) {
  await connection.query(
    `
      INSERT INTO nav_dropdown_groups (
        id,
        nav_item_id,
        title,
        position,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [group.id, itemId, group.title, index, now, now],
  );
}

export async function insertNavDropdownLinkRow(groupId, link, index, now, connection = getPool()) {
  await connection.query(
    `
      INSERT INTO nav_dropdown_links (
        id,
        group_id,
        label,
        href,
        position,
        badge,
        tracking_tag,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [link.id, groupId, link.label, link.href, index, link.badge, link.trackingTag, now, now],
  );
}

export async function insertNavPromoTileRow(itemId, tile, index, now, connection = getPool()) {
  await connection.query(
    `
      INSERT INTO nav_promo_tiles (
        id,
        nav_item_id,
        image_url,
        title,
        subtitle,
        href,
        position,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [tile.id, itemId, tile.imageUrl, tile.title, tile.subtitle, tile.href, index, now, now],
  );
}

export async function touchNavMenuUpdatedAt(menuId, now, connection = getPool()) {
  await connection.query(
    `
      UPDATE nav_menus
      SET updated_at = ?
      WHERE id = ?
    `,
    [now, menuId],
  );
}

export async function updateNavMenuPublishedState(menuId, nextVersion, publishedPayload, now, connection = getPool()) {
  await connection.query(
    `
      UPDATE nav_menus
      SET
        version = ?,
        published_payload = ?,
        published_at = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [nextVersion, publishedPayload ? JSON.stringify(publishedPayload) : null, now, now, menuId],
  );
}

export async function insertNavMenuWithDefaults(input, connection = getPool()) {
  await connection.query(
    `
      INSERT INTO nav_menus (
        id,
        menu_key,
        name,
        is_active,
        version,
        published_payload,
        published_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
    `,
    [
      input.id,
      input.key,
      input.name,
      input.version,
      JSON.stringify(input.publishedPayload),
      input.now,
      input.now,
      input.now,
    ],
  );
}
