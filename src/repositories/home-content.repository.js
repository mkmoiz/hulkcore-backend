import { getPool } from "../db/connection.js";
import { mapHomeContentRow } from "../mappers/theme.mapper.js";
import { normalizeCustomerCode } from "../utils/normalize.js";

export async function findHomeContentByCode(customerCode) {
  const normalizedCode = normalizeCustomerCode(customerCode);
  const [rows] = await getPool().query(
    `
      SELECT
        customer_code AS customerCode,
        payload,
        updated_at AS updatedAt
      FROM home_content
      WHERE customer_code = ?
      LIMIT 1
    `,
    [normalizedCode],
  );

  return mapHomeContentRow(rows[0]);
}

export async function upsertHomeContentRow(input, payload) {
  const now = new Date();
  const customerCode = normalizeCustomerCode(input?.customerCode);

  await getPool().query(
    `
      INSERT INTO home_content (
        customer_code,
        payload,
        updated_at
      ) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        payload = VALUES(payload),
        updated_at = VALUES(updated_at)
    `,
    [customerCode, JSON.stringify(payload), now],
  );

  return findHomeContentByCode(customerCode);
}
