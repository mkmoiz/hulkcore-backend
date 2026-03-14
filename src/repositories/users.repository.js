import { getPool } from "../db/connection.js";
import { mapUser } from "../mappers/auth.mapper.js";

export async function findUserRowByPhone(phone, connection = getPool()) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        phone,
        full_name AS fullName,
        email,
        address_line1 AS addressLine1,
        address_line2 AS addressLine2,
        city,
        state,
        postal_code AS postalCode,
        country,
        is_verified AS isVerified,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM users
      WHERE phone = ?
      LIMIT 1
    `,
    [phone],
  );

  return rows[0] ?? null;
}

export async function findUserRowByEmail(email, connection = getPool()) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        phone,
        full_name AS fullName,
        email,
        address_line1 AS addressLine1,
        address_line2 AS addressLine2,
        city,
        state,
        postal_code AS postalCode,
        country,
        is_verified AS isVerified,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email],
  );

  return rows[0] ?? null;
}

export async function findUserRowById(userId, connection = getPool()) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        phone,
        full_name AS fullName,
        email,
        address_line1 AS addressLine1,
        address_line2 AS addressLine2,
        city,
        state,
        postal_code AS postalCode,
        country,
        is_verified AS isVerified,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );

  return rows[0] ?? null;
}

export async function findUserByPhone(phone) {
  const userRow = await findUserRowByPhone(phone);
  return mapUser(userRow);
}

export async function insertUserVerified(userId, phone, now, connection = getPool()) {
  await connection.query(
    `
      INSERT INTO users (
        id,
        phone,
        is_verified,
        created_at,
        updated_at
      ) VALUES (?, ?, 1, ?, ?)
    `,
    [userId, phone, now, now],
  );
}

export async function insertUserVerifiedByEmail(userId, email, now, connection = getPool()) {
  await connection.query(
    `
      INSERT INTO users (
        id,
        phone,
        full_name,
        email,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        is_verified,
        created_at,
        updated_at
      ) VALUES (?, NULL, '', ?, NULL, NULL, NULL, NULL, NULL, NULL, 1, ?, ?)
    `,
    [userId, email, now, now],
  );
}

export async function markUserVerified(userId, now, connection = getPool()) {
  await connection.query(
    `
      UPDATE users
      SET is_verified = 1, updated_at = ?
      WHERE id = ?
    `,
    [now, userId],
  );
}

export async function upsertUserProfileById(userId, profile, now = new Date(), connection = getPool()) {
  await connection.query(
    `
      UPDATE users
      SET
        full_name = ?,
        email = ?,
        address_line1 = ?,
        address_line2 = ?,
        city = ?,
        state = ?,
        postal_code = ?,
        country = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [
      profile.fullName,
      profile.email,
      profile.addressLine1,
      profile.addressLine2,
      profile.city,
      profile.state,
      profile.postalCode,
      profile.country,
      now,
      userId,
    ],
  );

  return findUserRowById(userId, connection);
}
