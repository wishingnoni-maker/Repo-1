import path from "node:path";
import { existsSync } from "node:fs";
import sqlPkg from "mssql";
import type { EmployeeRepository } from "./EmployeeRepository.js";
import type { ClientRepository } from "./ClientRepository.js";
import type { ProjectRepository } from "./ProjectRepository.js";
import type { TimeEntryRepository } from "./TimeEntryRepository.js";
import { getDbPool, hasDatabaseUrl, isPostgresProviderEnabled } from "../db/pool.js";
import { resolveServerDataPath } from "../utils/paths.js";
import { JsonEmployeeRepository } from "./JsonEmployeeRepository.js";
import { JsonClientRepository } from "./JsonClientRepository.js";
import { JsonProjectRepository } from "./JsonProjectRepository.js";
import { JsonTimeEntryRepository } from "./JsonTimeEntryRepository.js";
import { SqlEmployeeRepository } from "./SqlEmployeeRepository.js";
import { PostgresEmployeeRepository } from "./postgresEmployeeRepository.js";
import { PostgresClientRepository } from "./postgresClientRepository.js";
import { PostgresProjectRepository } from "./postgresProjectRepository.js";
import { PostgresTimeEntryRepository } from "./postgresTimeEntryRepository.js";

const sql = sqlPkg as any;

const resolveEmployeeDataPath = () => {
  const configuredPath = process.env.JSON_DATA_PATH?.trim();

  if (!configuredPath) {
    return resolveServerDataPath("employees.json");
  }

  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }

  const normalizedConfiguredPath = configuredPath.replace(/\\/g, "/");
  if (
    path.basename(process.cwd()) === "server" &&
    (normalizedConfiguredPath === "./server/data/employees.json" ||
      normalizedConfiguredPath === "server/data/employees.json")
  ) {
    return resolveServerDataPath("employees.json");
  }

  const cwdResolved = path.resolve(process.cwd(), configuredPath);
  if (existsSync(cwdResolved)) {
    return cwdResolved;
  }

  if (configuredPath.endsWith("employees.json")) {
    return resolveServerDataPath("employees.json");
  }

  return cwdResolved;
};

export const createEmployeeRepository = (): EmployeeRepository => {
  const provider = process.env.DATA_PROVIDER ?? "json";

  if (isPostgresProviderEnabled()) {
    if (!hasDatabaseUrl()) {
      throw new Error("DATA_PROVIDER=postgres requires DATABASE_URL to be configured.");
    }
    return new PostgresEmployeeRepository(getDbPool());
  }

  if (provider === "sql") {
    return new SqlEmployeeRepository({
      server: process.env.AZURE_SQL_SERVER ?? "",
      database: process.env.AZURE_SQL_DATABASE ?? "",
      user: process.env.AZURE_SQL_USER ?? "",
      password: process.env.AZURE_SQL_PASSWORD ?? "",
      options: {
        encrypt: (process.env.AZURE_SQL_ENCRYPT ?? "true") === "true",
        trustServerCertificate: (process.env.AZURE_SQL_TRUST_SERVER_CERTIFICATE ?? "false") === "true"
      }
    });
  }

  const filePath = resolveEmployeeDataPath();
  return new JsonEmployeeRepository(filePath);
};

export const createClientRepository = (): ClientRepository => {
  if (isPostgresProviderEnabled()) {
    if (!hasDatabaseUrl()) {
      throw new Error("DATA_PROVIDER=postgres requires DATABASE_URL to be configured.");
    }
    return new PostgresClientRepository(getDbPool());
  }

  return new JsonClientRepository(resolveServerDataPath("clients.json"));
};

export const createProjectRepository = (): ProjectRepository => {
  if (isPostgresProviderEnabled()) {
    if (!hasDatabaseUrl()) {
      throw new Error("DATA_PROVIDER=postgres requires DATABASE_URL to be configured.");
    }
    return new PostgresProjectRepository(getDbPool());
  }

  return new JsonProjectRepository(resolveServerDataPath("projects.json"));
};

export const createTimeEntryRepository = (): TimeEntryRepository => {
  if (isPostgresProviderEnabled()) {
    if (!hasDatabaseUrl()) {
      throw new Error("DATA_PROVIDER=postgres requires DATABASE_URL to be configured.");
    }
    return new PostgresTimeEntryRepository(getDbPool());
  }

  return new JsonTimeEntryRepository(resolveServerDataPath("time-entries.json"));
};
