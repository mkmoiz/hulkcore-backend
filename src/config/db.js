export const DEFAULT_DB_CONFIG = {
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  password: "",
  database: "hulkcore",
  poolSize: 10,
};

export function getDatabaseConfig() {
  return { ...DEFAULT_DB_CONFIG };
}
