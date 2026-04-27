import path from "node:path";
import sqlPkg from "mssql";
import type { EmployeeRepository } from "./EmployeeRepository.js";
import { JsonEmployeeRepository } from "./JsonEmployeeRepository.js";
import { SqlEmployeeRepository } from "./SqlEmployeeRepository.js";

const sql = sqlPkg as any;

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

  const filePath = process.env.JSON_DATA_PATH
    ? path.resolve(process.cwd(), process.env.JSON_DATA_PATH)
    : path.resolve(process.cwd(), "data/employees.json");
  return new JsonEmployeeRepository(filePath);
};
