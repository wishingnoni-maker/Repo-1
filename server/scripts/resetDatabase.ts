import { closeDbPool } from "../src/db/pool.js";
import { loadScriptEnv, resetTables } from "./databaseUtils.js";
import { seedDatabase } from "./seedDatabase.js";

loadScriptEnv();

try {
  await resetTables();
  await seedDatabase();
  console.log("Reset PostgreSQL database and reseeded data.");
} finally {
  await closeDbPool();
}
