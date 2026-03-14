import { resolveDbConfig, validateDatabaseName } from "../db/config.js";
import { createDatabaseIfNotExists, initPool } from "../db/connection.js";
import { createSchema } from "../db/schema.js";
import { runMigrations } from "../db/migrations.js";
import { runSeeds } from "../db/seeds.js";

export async function initStore() {
  const dbConfig = resolveDbConfig();
  validateDatabaseName(dbConfig.database);

  await createDatabaseIfNotExists(dbConfig);
  initPool(dbConfig);

  await createSchema();
  await runMigrations();
  await runSeeds();
}
