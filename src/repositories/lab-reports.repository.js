import { getPool } from "../db/connection.js";
import { mapLabReport } from "../mappers/level.mapper.js";

export async function getLabReports(includeHidden = true) {
  const [rows] = await getPool().query(
    `
      SELECT
        lr.id,
        lr.title,
        lr.description,
        lr.report_url AS reportUrl,
        lr.report_key AS reportKey,
        lr.product_id AS productId,
        lr.is_active AS isActive,
        lr.position,
        lr.created_at AS createdAt,
        lr.updated_at AS updatedAt,
        p.id AS productIdRef,
        p.name AS productName,
        p.image_url AS productImageUrl,
        p.sku AS productSku
      FROM lab_reports lr
      LEFT JOIN products p ON p.id = lr.product_id
      ${includeHidden ? "" : "WHERE lr.is_active = 1"}
      ORDER BY lr.position ASC, lr.created_at ASC
    `,
  );

  return rows.map(mapLabReport).filter(Boolean);
}

export async function findLabReportById(id) {
  const [rows] = await getPool().query(
    `
      SELECT
        lr.id,
        lr.title,
        lr.description,
        lr.report_url AS reportUrl,
        lr.report_key AS reportKey,
        lr.product_id AS productId,
        lr.is_active AS isActive,
        lr.position,
        lr.created_at AS createdAt,
        lr.updated_at AS updatedAt,
        p.id AS productIdRef,
        p.name AS productName,
        p.image_url AS productImageUrl,
        p.sku AS productSku
      FROM lab_reports lr
      LEFT JOIN products p ON p.id = lr.product_id
      WHERE lr.id = ?
      LIMIT 1
    `,
    [id],
  );

  return mapLabReport(rows[0]);
}

export async function createLabReport(input) {
  const now = new Date();
  await getPool().query(
    `
      INSERT INTO lab_reports (
        id,
        title,
        description,
        report_url,
        report_key,
        product_id,
        is_active,
        position,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.id,
      input.title,
      input.description ?? "",
      input.reportUrl,
      input.reportKey ?? "",
      input.productId || null,
      input.isActive ? 1 : 0,
      input.position ?? 0,
      now,
      now,
    ],
  );

  return findLabReportById(input.id);
}

export async function updateLabReportById(id, input) {
  const now = new Date();
  const [result] = await getPool().query(
    `
      UPDATE lab_reports
      SET
        title = ?,
        description = ?,
        report_url = ?,
        report_key = ?,
        product_id = ?,
        is_active = ?,
        position = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [
      input.title,
      input.description ?? "",
      input.reportUrl,
      input.reportKey ?? "",
      input.productId || null,
      input.isActive ? 1 : 0,
      input.position ?? 0,
      now,
      id,
    ],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findLabReportById(id);
}

export async function deleteLabReportById(id) {
  const [result] = await getPool().query(
    `
      DELETE FROM lab_reports
      WHERE id = ?
    `,
    [id],
  );

  return result.affectedRows > 0;
}
