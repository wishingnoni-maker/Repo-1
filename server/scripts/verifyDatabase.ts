import { closeDbPool } from "../src/db/pool.js";
import {
  createClientRepository,
  createEmployeeRepository,
  createProjectRepository
} from "../src/repositories/index.js";
import { buildDashboardSummary } from "../src/services/dashboardService.js";
import { getPoolOrThrow, loadScriptEnv } from "./databaseUtils.js";
import { ClientService } from "../src/services/clientService.js";
import { ProjectService } from "../src/services/projectService.js";
import { getResolvedDataProvider, isPostgresProviderEnabled } from "../src/db/pool.js";

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
  const dataProvider = getResolvedDataProvider();
  const employeeRepository = createEmployeeRepository();
  const clientService = new ClientService(createClientRepository());
  const projectService = new ProjectService(createProjectRepository());

  console.log(`provider=${dataProvider}`);

  if (isPostgresProviderEnabled()) {
    const pool = getPoolOrThrow();
    await pool.query("SELECT 1");
    console.log("postgresConnected=true");
  } else {
    console.log("postgresConnected=false");
  }

  const [employees, clients, projects] = await Promise.all([
    employeeRepository.getAll(),
    clientService.getAll(),
    projectService.getAll()
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
