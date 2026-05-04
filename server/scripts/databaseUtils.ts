import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import XLSX from "xlsx";
import { getDbPool } from "../src/db/pool.js";
import { normalizeValue } from "../src/utils/text.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");

const defaultSourcePaths = {
  employees: "/Users/govindkishan/Downloads/Data Project/Employee Directory(Employee Directory 2026-01-15).csv",
  clients: "/Users/govindkishan/Downloads/Data Project/client(All Clients Report 2025-12-11).csv",
  projects: "/Users/govindkishan/Downloads/Data Project/Project(All Projects Report 2025-12-12).csv"
} as const;

export const loadScriptEnv = () => {
  dotenv.config({ path: path.resolve(serverRoot, ".env") });
};

export const getSchemaPath = () => path.resolve(serverRoot, "database", "schema.sql");

export const readSchemaSql = () => readFileSync(getSchemaPath(), "utf8");

export const getPoolOrThrow = (): Pool => {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required for PostgreSQL scripts.");
  }
  return getDbPool();
};

export const applySchema = async () => {
  const pool = getPoolOrThrow();
  await pool.query(readSchemaSql());
};

export const resetTables = async () => {
  const pool = getPoolOrThrow();
  await pool.query(`
    DROP TABLE IF EXISTS projects CASCADE;
    DROP TABLE IF EXISTS clients CASCADE;
    DROP TABLE IF EXISTS employees CASCADE;
    DROP FUNCTION IF EXISTS set_updated_at_timestamp() CASCADE;
  `);
};

export const deterministicUuid = (namespace: string, key: string) => {
  const digest = crypto.createHash("sha256").update(`${namespace}:${key}`).digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
};

export const resolveSourcePath = (kind: keyof typeof defaultSourcePaths) => {
  const envKey =
    kind === "employees"
      ? "EMPLOYEE_SOURCE_CSV"
      : kind === "clients"
        ? "CLIENT_SOURCE_CSV"
        : "PROJECT_SOURCE_CSV";

  const configured = process.env[envKey]?.trim();
  if (configured && existsSync(configured)) {
    return configured;
  }

  const fallback = defaultSourcePaths[kind];
  if (existsSync(fallback)) {
    return fallback;
  }

  throw new Error(`Unable to find source file for ${kind}. Set ${envKey} in server/.env.`);
};

export const readRowsFromFile = (filePath: string) => {
  const buffer = readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];

  return XLSX.utils
    .sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" })
    .filter((row) => Object.values(row).some((value) => normalizeValue(value)));
};
