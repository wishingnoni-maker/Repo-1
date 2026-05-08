import { Pool, type PoolConfig } from "pg";

let pool: Pool | null = null;

const normalizeProvider = () => process.env.DATA_PROVIDER?.trim().toLowerCase() ?? "";

const getConnectionString = () => process.env.DATABASE_URL?.trim() ?? "";

const getDatabaseUrlParam = (name: string) => {
  const connectionString = getConnectionString();
  if (!connectionString) {
    return "";
  }

  try {
    return new URL(connectionString).searchParams.get(name)?.trim().toLowerCase() ?? "";
  } catch {
    return "";
  }
};

export const getResolvedDataProvider = () => {
  const provider = normalizeProvider();

  if (provider === "postgres" || provider === "postgresql") {
    return "postgres";
  }

  if (provider === "sql") {
    return "sql";
  }

  if (provider === "json") {
    return "json";
  }

  return hasDatabaseUrl() ? "postgres" : "json";
};

export const isPostgresProviderEnabled = () => getResolvedDataProvider() === "postgres";

const shouldUseSsl = () => {
  const raw = process.env.DATABASE_SSL?.trim().toLowerCase();
  const mode = process.env.PGSSLMODE?.trim().toLowerCase();
  const connectionString = getConnectionString();
  const sslMode = getDatabaseUrlParam("sslmode");

  if (raw === "true" || raw === "require") {
    return { rejectUnauthorized: false };
  }

  if (mode === "require" || mode === "prefer" || mode === "no-verify") {
    return { rejectUnauthorized: false };
  }

  if (sslMode === "require" || sslMode === "prefer" || sslMode === "verify-full" || sslMode === "verify-ca") {
    return { rejectUnauthorized: false };
  }

  if (
    connectionString &&
    !connectionString.includes("@localhost:") &&
    !connectionString.includes("@127.0.0.1:")
  ) {
    return { rejectUnauthorized: false };
  }

  return false;
};

export const hasDatabaseUrl = () => Boolean(process.env.DATABASE_URL?.trim());

export const getDbPool = () => {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!pool) {
    const poolConfig: PoolConfig = {
      connectionString,
      ssl: shouldUseSsl()
    };
    const channelBinding = getDatabaseUrlParam("channel_binding");

    if (channelBinding === "require" || channelBinding === "prefer") {
      (poolConfig as PoolConfig & { enableChannelBinding: boolean }).enableChannelBinding = true;
    }

    pool = new Pool(poolConfig);
  }

  return pool;
};

export const closeDbPool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};
