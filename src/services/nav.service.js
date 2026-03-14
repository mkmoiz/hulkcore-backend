import { createId } from "../utils.js";
import { getPool } from "../db/connection.js";
import { DEFAULT_MAIN_SECONDARY_NAV_ITEMS } from "../constants/nav.constants.js";
import { mapNavMenu } from "../mappers/nav.mapper.js";
import { toIsoString } from "../utils/dates.js";
import { parsePublishedNavPayload } from "../utils/json.js";
import { normalizeNavMenuKey, normalizeNavMenuName, normalizeText } from "../utils/normalize.js";
import {
  createNavMenuRow,
  deleteNavItemsByMenuId,
  findNavMenuById,
  findNavMenuByKey,
  findNavMenuRowById,
  findNavMenuRowByKey,
  getNavMenus,
  insertNavDropdownGroupRow,
  insertNavDropdownLinkRow,
  insertNavItemRow,
  insertNavMenuWithDefaults,
  insertNavPromoTileRow,
  loadNavItemsByMenuId,
  touchNavMenuUpdatedAt,
  updateNavMenuMetaRowById,
  updateNavMenuPublishedState,
} from "../repositories/nav.repository.js";

export { getNavMenus, findNavMenuById, findNavMenuByKey };

export async function getNavMenuDraftById(menuId) {
  const menuRow = await findNavMenuRowById(menuId);
  if (!menuRow) {
    return null;
  }

  const draftItems = await loadNavItemsByMenuId(menuId);
  return {
    ...mapNavMenu(menuRow),
    items: draftItems,
    published: parsePublishedNavPayload(menuRow.publishedPayload),
  };
}

export async function createNavMenu(input) {
  const menuRow = await createNavMenuRow({
    id: normalizeText(input?.id),
    key: normalizeNavMenuKey(input?.key),
    name: normalizeNavMenuName(input?.name),
    isActive: input?.isActive,
  });

  return getNavMenuDraftById(menuRow.id);
}

export async function updateNavMenuById(menuId, input) {
  const row = await updateNavMenuMetaRowById(menuId, {
    key: normalizeNavMenuKey(input?.key),
    name: normalizeNavMenuName(input?.name),
    isActive: input?.isActive,
  });

  if (!row) {
    return null;
  }

  return getNavMenuDraftById(menuId);
}

export async function replaceNavMenuItems(menuId, items) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const menuRow = await findNavMenuRowById(menuId, connection);
    if (!menuRow) {
      await connection.rollback();
      return null;
    }

    await deleteNavItemsByMenuId(menuId, connection);

    const now = new Date();
    for (const [itemIndex, item] of items.entries()) {
      const itemId = normalizeText(item?.id) || createId("nvi");
      const itemType = normalizeText(item?.type).toUpperCase();
      const isVisible = item?.isVisible ? 1 : 0;

      await insertNavItemRow(
        menuId,
        {
          id: itemId,
          label: normalizeText(item?.label),
          type: itemType,
          href: normalizeText(item?.href),
          target: normalizeText(item?.target, "_self"),
          isVisible: Boolean(isVisible),
          icon: normalizeText(item?.icon),
        },
        itemIndex,
        now,
        connection,
      );

      if (itemType !== "DROPDOWN") {
        continue;
      }

      const groups = Array.isArray(item?.dropdownGroups) ? item.dropdownGroups : [];
      for (const [groupIndex, group] of groups.entries()) {
        const groupId = normalizeText(group?.id) || createId("nvg");
        await insertNavDropdownGroupRow(
          itemId,
          {
            id: groupId,
            title: normalizeText(group?.title),
          },
          groupIndex,
          now,
          connection,
        );

        const links = Array.isArray(group?.links) ? group.links : [];
        for (const [linkIndex, link] of links.entries()) {
          await insertNavDropdownLinkRow(
            groupId,
            {
              id: normalizeText(link?.id) || createId("nvl"),
              label: normalizeText(link?.label),
              href: normalizeText(link?.href),
              badge: normalizeText(link?.badge),
              trackingTag: normalizeText(link?.trackingTag),
            },
            linkIndex,
            now,
            connection,
          );
        }
      }

      const promoTiles = Array.isArray(item?.promoTiles) ? item.promoTiles : [];
      for (const [tileIndex, tile] of promoTiles.entries()) {
        await insertNavPromoTileRow(
          itemId,
          {
            id: normalizeText(tile?.id) || createId("nvt"),
            imageUrl: normalizeText(tile?.imageUrl),
            title: normalizeText(tile?.title),
            subtitle: normalizeText(tile?.subtitle),
            href: normalizeText(tile?.href),
          },
          tileIndex,
          now,
          connection,
        );
      }
    }

    await touchNavMenuUpdatedAt(menuId, now, connection);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getNavMenuDraftById(menuId);
}

export async function publishNavMenuById(menuId, publishedPayloadInput) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const menuRow = await findNavMenuRowById(menuId, connection);
    if (!menuRow) {
      await connection.rollback();
      return null;
    }

    const now = new Date();
    const nextVersion = Number(menuRow.version ?? 0) + 1;
    const publishedPayload =
      publishedPayloadInput && typeof publishedPayloadInput === "object"
        ? {
            ...publishedPayloadInput,
            version: nextVersion,
            publishedAt: now.toISOString(),
          }
        : null;

    await updateNavMenuPublishedState(menuId, nextVersion, publishedPayload, now, connection);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getPublishedNavMenuByKey((await findNavMenuById(menuId))?.key || "");
}

export async function getPublishedNavMenuByKey(menuKey) {
  const menuRow = await findNavMenuRowByKey(menuKey);
  if (!menuRow || !Boolean(menuRow.isActive)) {
    return null;
  }

  const publishedPayload = parsePublishedNavPayload(menuRow.publishedPayload);
  if (!publishedPayload) {
    return null;
  }

  return {
    ...publishedPayload,
    id: menuRow.id,
    key: menuRow.key,
    name: menuRow.name,
    isActive: Boolean(menuRow.isActive),
    version: Number(menuRow.version ?? publishedPayload.version ?? 0),
    publishedAt: menuRow.publishedAt ? toIsoString(menuRow.publishedAt) : publishedPayload.publishedAt ?? null,
    updatedAt: toIsoString(menuRow.updatedAt),
  };
}

export async function seedDefaultMainSecondaryMenu() {
  const existingMenu = await findNavMenuRowByKey("main_secondary");
  if (existingMenu) {
    return;
  }

  const now = new Date();
  const menuId = createId("nvm");
  const version = 1;
  const publishedAt = now.toISOString();
  const publishedPayload = {
    id: menuId,
    key: "main_secondary",
    name: "Main Secondary Navigation",
    isActive: true,
    version,
    publishedAt,
    updatedAt: publishedAt,
    items: DEFAULT_MAIN_SECONDARY_NAV_ITEMS,
  };

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    await insertNavMenuWithDefaults(
      {
        id: menuId,
        key: "main_secondary",
        name: "Main Secondary Navigation",
        version,
        publishedPayload,
        now,
      },
      connection,
    );

    for (const [itemIndex, rawItem] of DEFAULT_MAIN_SECONDARY_NAV_ITEMS.entries()) {
      const itemId = createId("nvi");
      await insertNavItemRow(
        menuId,
        {
          id: itemId,
          label: rawItem.label,
          type: rawItem.type,
          href: rawItem.href || "",
          target: rawItem.target || "_self",
          isVisible: Boolean(rawItem.isVisible),
          icon: rawItem.icon || "",
        },
        itemIndex,
        now,
        connection,
      );

      if (rawItem.type !== "DROPDOWN") {
        continue;
      }

      const groups = Array.isArray(rawItem.dropdownGroups) ? rawItem.dropdownGroups : [];
      for (const [groupIndex, rawGroup] of groups.entries()) {
        const groupId = createId("nvg");
        await insertNavDropdownGroupRow(
          itemId,
          { id: groupId, title: rawGroup.title || "" },
          groupIndex,
          now,
          connection,
        );

        const links = Array.isArray(rawGroup.links) ? rawGroup.links : [];
        for (const [linkIndex, rawLink] of links.entries()) {
          await insertNavDropdownLinkRow(
            groupId,
            {
              id: createId("nvl"),
              label: rawLink.label,
              href: rawLink.href,
              badge: rawLink.badge || "",
              trackingTag: rawLink.trackingTag || "",
            },
            linkIndex,
            now,
            connection,
          );
        }
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
