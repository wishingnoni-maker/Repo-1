import { Pool } from "pg";

let pool: Pool | null = null;

const shouldUseSsl = () => {
  const raw = process.env.DATABASE_SSL?.trim().toLowerCase();
  const mode = process.env.PGSSLMODE?.trim().toLowerCase();

  if (raw === "true" || raw === "require") {
    return { rejectUnauthorized: false };
  }

  if (mode === "require" || mode === "prefer" || mode === "no-verify") {
    return { rejectUnauthorized: false };
  }

  return false;
};

export const hasDatabaseUrl = () => Boolean(process.env.DATABASE_URL?.trim());

export const getDbPool = () => {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: shouldUseSsl()
    });
  }

  return pool;
};

export const closeDbPool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};
