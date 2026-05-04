import { closeDbPool } from "../src/db/pool.js";
import { applySchema, loadScriptEnv } from "./databaseUtils.js";

loadScriptEnv();

try {
  await applySchema();
  console.log("Applied PostgreSQL schema.");
} finally {
  await closeDbPool();
}
