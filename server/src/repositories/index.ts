import path from "node:path";
import { existsSync } from "node:fs";
import sqlPkg from "mssql";
import type { EmployeeRepository } from "./EmployeeRepository.js";
import { JsonEmployeeRepository } from "./JsonEmployeeRepository.js";
import { SqlEmployeeRepository } from "./SqlEmployeeRepository.js";
import { resolveServerDataPath } from "../utils/paths.js";

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
