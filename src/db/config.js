import { getDatabaseConfig } from "../config/db.js";
import { parsePositiveInt } from "../utils/normalize.js";

const DEFAULT_DB_CONFIG = getDatabaseConfig();

export function validateDatabaseName(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error("DB_NAME must contain only letters, numbers, and underscore.");
  }
}

export function resolveDbConfig() {
  const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;

  if (databaseUrl) {
    let parsedUrl;
    try {
      parsedUrl = new URL(databaseUrl);
    } catch {
      throw new Error("DATABASE_URL is invalid.");
    }

    if (parsedUrl.protocol !== "mysql:") {
      throw new Error("DATABASE_URL must start with mysql://");
    }

    const dbNameFromUrl = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
    return {
      host: parsedUrl.hostname || DEFAULT_DB_CONFIG.host,
      port: parsePositiveInt(parsedUrl.port, DEFAULT_DB_CONFIG.port),
      user: decodeURIComponent(parsedUrl.username || DEFAULT_DB_CONFIG.user),
      password: decodeURIComponent(parsedUrl.password || DEFAULT_DB_CONFIG.password),
      database: dbNameFromUrl || process.env.DB_NAME || DEFAULT_DB_CONFIG.database,
      poolSize: parsePositiveInt(process.env.DB_POOL_SIZE, DEFAULT_DB_CONFIG.poolSize),
    };
  }

  return {
    host: process.env.DB_HOST || DEFAULT_DB_CONFIG.host,
    port: parsePositiveInt(process.env.DB_PORT, DEFAULT_DB_CONFIG.port),
    user: process.env.DB_USER || DEFAULT_DB_CONFIG.user,
    password: process.env.DB_PASSWORD || DEFAULT_DB_CONFIG.password,
    database: process.env.DB_NAME || DEFAULT_DB_CONFIG.database,
    poolSize: parsePositiveInt(process.env.DB_POOL_SIZE, DEFAULT_DB_CONFIG.poolSize),
  };
}
