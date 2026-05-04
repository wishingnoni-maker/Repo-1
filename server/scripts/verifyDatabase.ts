import { closeDbPool } from "../src/db/pool.js";
import { PostgresEmployeeRepository } from "../src/repositories/postgresEmployeeRepository.js";
import { PostgresClientRepository } from "../src/repositories/postgresClientRepository.js";
import { PostgresProjectRepository } from "../src/repositories/postgresProjectRepository.js";
import { buildDashboardSummary } from "../src/services/dashboardService.js";
import { getPoolOrThrow, loadScriptEnv } from "./databaseUtils.js";

loadScriptEnv();

const expected = {
  employees: 39,
  clients: 187,
  projects: 708,
  clientsMissingManager: 128,
  projectsMissingPoNumber: 688,
  activeProjects: 0
} as const;

try {
  const pool = getPoolOrThrow();
  const employeeRepository = new PostgresEmployeeRepository(pool);
  const clientRepository = new PostgresClientRepository(pool);
  const projectRepository = new PostgresProjectRepository(pool);

  const [employees, clients, projects] = await Promise.all([
    employeeRepository.getAll(),
    clientRepository.getAll(),
    projectRepository.getAll()
  ]);

  if (employees.length !== expected.employees) {
    throw new Error(`Employee count mismatch: expected ${expected.employees}, received ${employees.length}.`);
  }
  if (clients.length !== expected.clients) {
    throw new Error(`Client count mismatch: expected ${expected.clients}, received ${clients.length}.`);
  }
  if (projects.length !== expected.projects) {
    throw new Error(`Project count mismatch: expected ${expected.projects}, received ${projects.length}.`);
  }

  const dashboard = buildDashboardSummary(employees, clients, projects);
  if (dashboard.clientsMissingManager !== expected.clientsMissingManager) {
    throw new Error(
      `Client missing-manager mismatch: expected ${expected.clientsMissingManager}, received ${dashboard.clientsMissingManager}.`
    );
  }
  if (dashboard.projectsMissingPoNumber !== expected.projectsMissingPoNumber) {
    throw new Error(
      `Project missing-PO mismatch: expected ${expected.projectsMissingPoNumber}, received ${dashboard.projectsMissingPoNumber}.`
    );
  }
  if (dashboard.activeProjects !== expected.activeProjects) {
    throw new Error(`Active-project mismatch: expected ${expected.activeProjects}, received ${dashboard.activeProjects}.`);
  }

  const employeeRegions = new Set(dashboard.employeesByRegion.map((entry) => entry.label));
  for (const region of ["US", "EU", "APAC"]) {
    if (!employeeRegions.has(region)) {
      throw new Error(`Expected employee region ${region} to be present in dashboard summary.`);
    }
  }

  console.log(`employees=${employees.length}`);
  console.log(`clients=${clients.length}`);
  console.log(`projects=${projects.length}`);
  console.log(`projectsMissingPoNumber=${dashboard.projectsMissingPoNumber}`);
  console.log(`clientsMissingManager=${dashboard.clientsMissingManager}`);
  console.log(`employeesByRegion=${dashboard.employeesByRegion.map((entry) => `${entry.label}:${entry.value}`).join(", ")}`);
  console.log(`dashboardTotals=${dashboard.totalEmployees}/${dashboard.totalClients}/${dashboard.totalProjects}`);
} finally {
  await closeDbPool();
}
