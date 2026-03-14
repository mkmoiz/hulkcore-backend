import mysql from "mysql2/promise";

let pool = null;

export function getPool() {
  if (!pool) {
    throw new Error("Database pool is not initialized.");
  }

  return pool;
}

export async function createDatabaseIfNotExists(dbConfig) {
  const bootstrapConnection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
  });

  await bootstrapConnection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await bootstrapConnection.end();
}

export function initPool(dbConfig) {
  pool = mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    waitForConnections: true,
    connectionLimit: dbConfig.poolSize,
    queueLimit: 0,
    timezone: "Z",
    decimalNumbers: true,
  });

  return pool;
}
