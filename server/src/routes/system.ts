import { Router } from "express";
import { getDbPool, getResolvedDataProvider, hasDatabaseUrl } from "../db/pool.js";
import type { EmployeeRepository } from "../repositories/EmployeeRepository.js";
import { ClientService } from "../services/clientService.js";
import { ProjectService } from "../services/projectService.js";

const sanitizeError = (error: unknown) => {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";

  return raw
    .replace(/postgres(?:ql)?:\/\/[^@]+@/gi, "postgresql://***@")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
};

const hasDatabaseSsl = () => {
  const envFlag = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (envFlag === "true" || envFlag === "require") {
    return true;
  }

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    return false;
  }

  try {
    const sslMode = new URL(connectionString).searchParams.get("sslmode")?.trim().toLowerCase();
    return Boolean(
      sslMode &&
        ["require", "prefer", "verify-full", "verify-ca"].includes(sslMode)
    );
  } catch {
    return false;
  }
};

export const createSystemRouter = (
  employeeRepository: EmployeeRepository,
  clientService: ClientService,
  projectService: ProjectService
) => {
  const router = Router();

  router.get("/status", async (_req, res) => {
    const dataProvider = getResolvedDataProvider();
    const hasDbUrl = hasDatabaseUrl();
    const databaseSsl = hasDatabaseSsl();
    let postgresConnected: boolean | null = dataProvider === "postgres" ? false : null;
    let postgresError: string | null = null;
    let counts: { employees: number | null; clients: number | null; projects: number | null } = {
      employees: null,
      clients: null,
      projects: null
    };

    try {
      if (dataProvider === "postgres") {
        await getDbPool().query("SELECT 1");
        postgresConnected = true;
      }

      const [employees, clients, projects] = await Promise.all([
        employeeRepository.getAll(),
        clientService.getAll(),
        projectService.getAll()
      ]);

      counts = {
        employees: employees.length,
        clients: clients.length,
        projects: projects.length
      };
    } catch (error) {
      postgresError = sanitizeError(error);
      if (dataProvider === "postgres") {
        postgresConnected = false;
      }
    }

    res.json({
      ok: dataProvider === "postgres" ? postgresConnected === true : true,
      dataProvider,
      hasDatabaseUrl: hasDbUrl,
      databaseSsl,
      postgresConnected,
      postgresError,
      counts
    });
  });

  return router;
};
