import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDbPool } from "../src/db/pool.js";
import { employeeInputSchema, mapExcelRowToEmployeeInput } from "../src/utils/employee.js";
import {
  clientInputSchema,
  mapRowToClientInput
} from "../src/utils/client.js";
import {
  mapRowToProjectInput,
  projectInputSchema
} from "../src/utils/project.js";
import {
  applySchema,
  deterministicUuid,
  getPoolOrThrow,
  loadScriptEnv,
  readRowsFromFile,
  resolveSourcePath
} from "./databaseUtils.js";

const expectedCounts = {
  employees: 39,
  clients: 187,
  projects: 708
} as const;

const now = new Date().toISOString();

const assertCount = (label: keyof typeof expectedCounts, actual: number) => {
  if (actual !== expectedCounts[label]) {
    throw new Error(`Expected ${expectedCounts[label]} ${label}, received ${actual}.`);
  }
};

const seedEmployees = async () => {
  const rows = readRowsFromFile(resolveSourcePath("employees"));
  const inputs = rows.map((row, index) => {
    const parsed = employeeInputSchema.safeParse(mapExcelRowToEmployeeInput(row));
    if (!parsed.success) {
      throw new Error(`Invalid employee row ${index + 2}: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`);
    }

    const key = parsed.data.email || `${parsed.data.fullName}-${index}`;
    return {
      id: deterministicUuid("employee", key.toLowerCase()),
      ...parsed.data
    };
  });

  assertCount("employees", inputs.length);

  const pool = getPoolOrThrow();
  await pool.query("TRUNCATE TABLE employees RESTART IDENTITY");

  for (const employee of inputs) {
    await pool.query(
      `
        INSERT INTO employees (
          id,
          first_name,
          last_name,
          full_name,
          email,
          title,
          employee_region,
          supervisor_name,
          employee_cell,
          country,
          title_code,
          hire_date,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `,
      [
        employee.id,
        employee.firstName,
        employee.lastName,
        employee.fullName,
        employee.email,
        employee.title,
        employee.employeeRegion,
        employee.supervisorName,
        employee.employeeCell,
        employee.country,
        employee.titleCode,
        employee.hireDate,
        now,
        now
      ]
    );
  }

  return inputs.length;
};

const seedClients = async () => {
  const rows = readRowsFromFile(resolveSourcePath("clients"));
  const inputs = rows.map((row, index) => {
    const parsed = clientInputSchema.safeParse(mapRowToClientInput(row));
    if (!parsed.success) {
      throw new Error(`Invalid client row ${index + 2}: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`);
    }

    return {
      id: deterministicUuid("client", parsed.data.clientName.toLowerCase()),
      ...parsed.data
    };
  });

  assertCount("clients", inputs.length);

  const pool = getPoolOrThrow();
  await pool.query("TRUNCATE TABLE clients RESTART IDENTITY");

  for (const client of inputs) {
    await pool.query(
      `
        INSERT INTO clients (
          id,
          client_name,
          status,
          invoice_currency,
          client_contact,
          client_manager,
          client_description,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        client.id,
        client.clientName,
        client.clientStatus,
        client.clientInvoiceCurrency,
        client.clientContact,
        client.clientManager,
        client.clientDescription,
        now,
        now
      ]
    );
  }

  return inputs.length;
};

const seedProjects = async () => {
  const rows = readRowsFromFile(resolveSourcePath("projects"));
  const inputs = rows.map((row, index) => {
    const parsed = projectInputSchema.safeParse(mapRowToProjectInput(row));
    if (!parsed.success) {
      throw new Error(`Invalid project row ${index + 2}: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`);
    }

    return {
      id: deterministicUuid("project", parsed.data.projectName.toLowerCase()),
      ...parsed.data
    };
  });

  assertCount("projects", inputs.length);

  const pool = getPoolOrThrow();
  await pool.query("TRUNCATE TABLE projects RESTART IDENTITY");

  for (const project of inputs) {
    await pool.query(
      `
        INSERT INTO projects (
          id,
          project_name,
          project_estimated_hrs,
          project_status,
          project_currency,
          project_manager,
          project_manager_email,
          project_start_date,
          project_end_date,
          project_description,
          budget_hours,
          budget_cost,
          expense_budget,
          project_region,
          po_number,
          project_sold_by,
          number_of_resources,
          number_of_work_weeks,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      `,
      [
        project.id,
        project.projectName,
        project.projectEstimatedHrs,
        project.projectStatus,
        project.projectCurrency,
        project.projectManager,
        project.projectManagerEmail,
        project.projectStartDate,
        project.projectEndDate,
        project.projectDescription,
        project.budgetHours,
        project.budgetCost,
        project.expenseBudgetProjectCurrency,
        project.projectRegion,
        project.poNumber,
        project.projectSoldBy,
        project.numberOfResources,
        project.numberOfWorkWeeks,
        now,
        now
      ]
    );
  }

  return inputs.length;
};

export const seedDatabase = async () => {
  await applySchema();
  const [employees, clients, projects] = await Promise.all([
    seedEmployees(),
    seedClients(),
    seedProjects()
  ]);

  console.log(`Seeded employees: ${employees}`);
  console.log(`Seeded clients: ${clients}`);
  console.log(`Seeded projects: ${projects}`);
};

loadScriptEnv();

const isDirectRun = (() => {
  const currentPath = fileURLToPath(import.meta.url);
  const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return currentPath === entryPath;
})();

if (isDirectRun) {
  try {
    await seedDatabase();
  } finally {
    await closeDbPool();
  }
}
