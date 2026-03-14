import { getPool } from "../db/connection.js";

export async function markOpenOtpChallengesConsumedByPhone(phone, now) {
  await getPool().query(
    `
      UPDATE otp_challenges
      SET consumed_at = ?, updated_at = ?
      WHERE phone = ? AND consumed_at IS NULL
    `,
    [now, now, phone],
  );
}

export async function markOpenEmailOtpChallengesConsumedByEmail(email, now) {
  await getPool().query(
    `
      UPDATE email_otp_challenges
      SET consumed_at = ?, updated_at = ?
      WHERE email = ? AND consumed_at IS NULL
    `,
    [now, now, email],
  );
}

export async function insertOtpChallenge(entry) {
  await getPool().query(
    `
      INSERT INTO otp_challenges (
        id,
        phone,
        otp_hash,
        attempts_remaining,
        expires_at,
        consumed_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    `,
    [entry.id, entry.phone, entry.otpHash, entry.attemptsRemaining, entry.expiresAt, entry.now, entry.now],
  );
}

export async function insertEmailOtpChallenge(entry) {
  await getPool().query(
    `
      INSERT INTO email_otp_challenges (
        id,
        email,
        otp_hash,
        attempts_remaining,
        expires_at,
        consumed_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    `,
    [entry.id, entry.email, entry.otpHash, entry.attemptsRemaining, entry.expiresAt, entry.now, entry.now],
  );
}

export async function findOtpChallengeRowByIdAndPhone(challengeId, phone, connection = getPool(), forUpdate = false) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        phone,
        otp_hash AS otpHash,
        attempts_remaining AS attemptsRemaining,
        expires_at AS expiresAt,
        consumed_at AS consumedAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM otp_challenges
      WHERE id = ? AND phone = ?
      LIMIT 1
      ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [challengeId, phone],
  );

  return rows[0] ?? null;
}

export async function findEmailOtpChallengeRowByIdAndEmail(challengeId, email, connection = getPool(), forUpdate = false) {
  const [rows] = await connection.query(
    `
      SELECT
        id,
        email,
        otp_hash AS otpHash,
        attempts_remaining AS attemptsRemaining,
        expires_at AS expiresAt,
        consumed_at AS consumedAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM email_otp_challenges
      WHERE id = ? AND email = ?
      LIMIT 1
      ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [challengeId, email],
  );

  return rows[0] ?? null;
}

export async function consumeOtpChallengeById(challengeId, now, connection = getPool()) {
  await connection.query(
    `
      UPDATE otp_challenges
      SET consumed_at = ?, updated_at = ?
      WHERE id = ?
    `,
    [now, now, challengeId],
  );
}

export async function consumeEmailOtpChallengeById(challengeId, now, connection = getPool()) {
  await connection.query(
    `
      UPDATE email_otp_challenges
      SET consumed_at = ?, updated_at = ?
      WHERE id = ?
    `,
    [now, now, challengeId],
  );
}

export async function updateOtpAttemptsById(challengeId, attemptsRemaining, now, connection = getPool()) {
  await connection.query(
    `
      UPDATE otp_challenges
      SET attempts_remaining = ?, updated_at = ?
      WHERE id = ?
    `,
    [attemptsRemaining, now, challengeId],
  );
}

export async function updateEmailOtpAttemptsById(challengeId, attemptsRemaining, now, connection = getPool()) {
  await connection.query(
    `
      UPDATE email_otp_challenges
      SET attempts_remaining = ?, updated_at = ?
      WHERE id = ?
    `,
    [attemptsRemaining, now, challengeId],
  );
}

export async function insertAuthSession(entry, connection = getPool()) {
  await connection.query(
    `
      INSERT INTO auth_sessions (
        token,
        user_id,
        expires_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?)
    `,
    [entry.token, entry.userId, entry.expiresAt, entry.now, entry.now],
  );
}

export async function findAuthSessionRowByToken(token, connection = getPool()) {
  const [rows] = await connection.query(
    `
      SELECT
        s.token,
        s.user_id AS userId,
        s.expires_at AS expiresAt,
        s.created_at AS createdAt,
        u.phone AS userPhone,
        u.full_name AS userFullName,
        u.email AS userEmail,
        u.address_line1 AS userAddressLine1,
        u.address_line2 AS userAddressLine2,
        u.city AS userCity,
        u.state AS userState,
        u.postal_code AS userPostalCode,
        u.country AS userCountry,
        u.is_verified AS userIsVerified,
        u.created_at AS userCreatedAt,
        u.updated_at AS userUpdatedAt
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
      LIMIT 1
    `,
    [token],
  );

  return rows[0] ?? null;
}

export async function deleteAuthSessionByToken(token) {
  const [result] = await getPool().query(
    `
      DELETE FROM auth_sessions
      WHERE token = ?
    `,
    [token],
  );

  return result.affectedRows > 0;
}
