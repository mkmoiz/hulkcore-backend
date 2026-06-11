import { getPool } from "../db/connection.js";

export async function getAnnouncements() {
  const [rows] = await getPool().query(`
    SELECT
      id,
      text,
      href,
      sort_order AS sortOrder,
      is_active AS isActive,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM announcement_items
    ORDER BY sort_order ASC, created_at DESC
  `);

  return rows.map(mapAnnouncement);
}

export async function findAnnouncementById(id) {
  const [rows] = await getPool().query(
    `
      SELECT
        id,
        text,
        href,
        sort_order AS sortOrder,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM announcement_items
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] ? mapAnnouncement(rows[0]) : null;
}

export async function createAnnouncement(input) {
  const now = new Date();
  await getPool().query(
    `
      INSERT INTO announcement_items (
        id,
        text,
        href,
        sort_order,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.id,
      input.text ?? "",
      input.href ?? "",
      input.sortOrder ?? 0,
      input.isActive ? 1 : 0,
      now,
      now,
    ],
  );

  return findAnnouncementById(input.id);
}

export async function updateAnnouncementById(id, input) {
  const now = new Date();
  const [result] = await getPool().query(
    `
      UPDATE announcement_items
      SET
        text = ?,
        href = ?,
        sort_order = ?,
        is_active = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [
      input.text ?? "",
      input.href ?? "",
      input.sortOrder ?? 0,
      input.isActive ? 1 : 0,
      now,
      id,
    ],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findAnnouncementById(id);
}

export async function deleteAnnouncementById(id) {
  const [result] = await getPool().query(
    `
      DELETE FROM announcement_items
      WHERE id = ?
    `,
    [id],
  );

  return result.affectedRows > 0;
}

function mapAnnouncement(row) {
  if (!row) return null;
  return {
    id: row.id,
    text: row.text ?? "",
    href: row.href ?? "",
    sortOrder: Number(row.sortOrder ?? 0),
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}
