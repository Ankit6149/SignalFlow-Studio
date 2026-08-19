import { neon } from "@neondatabase/serverless";

export const SIGNALFLOW_DATABASE_ENV = "DATABASE_URL";

export function createNeonQueryExecutor({ databaseUrl = process.env[SIGNALFLOW_DATABASE_ENV] } = {}) {
  const connectionString = String(databaseUrl || "").trim();
  if (!connectionString) {
    const error = new Error("SignalFlow durable database is not configured.");
    error.code = "signalflow_database_unconfigured";
    throw error;
  }
  if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) {
    const error = new Error("SignalFlow durable database configuration is invalid.");
    error.code = "signalflow_database_invalid";
    throw error;
  }

  const sql = neon(connectionString);
  return Object.freeze({
    async query(statement, params = []) {
      if (typeof statement !== "string" || !statement.trim()) {
        throw new TypeError("Database query requires a SQL statement.");
      }
      if (!Array.isArray(params)) throw new TypeError("Database query params must be an array.");
      return sql.query(statement, params);
    },
  });
}
