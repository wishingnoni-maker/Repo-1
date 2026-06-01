import type { Pool } from "pg";
import type {
  PaginatedProjects,
  Project,
  ProjectFilters,
  ProjectInput
} from "../types.js";
import {
  createProjectRecord,
  matchesProjectFilters,
  mergeProjectRecord
} from "../utils/project.js";
import { normalizeValue } from "../utils/text.js";
import type { ProjectRepository } from "./ProjectRepository.js";

type ProjectRow = {
  id: string;
  project_name: string;
  project_estimated_hrs: string | number | null;
  project_status: string | null;
  project_currency: string | null;
  project_manager: string | null;
  project_manager_email: string | null;
  project_start_date: string | null;
  project_end_date: string | null;
  project_description: string | null;
  budget_hours: string | number | null;
  budget_cost: string | number | null;
  expense_budget: string | number | null;
  project_region: string | null;
  po_number: string | null;
  project_sold_by: string | null;
  number_of_resources: string | number | null;
  number_of_work_weeks: string | number | null;
  planned_loe_hours: string | number | null;
  sold_amount: string | number | null;
  blended_bill_rate: string | number | null;
  blended_cost_rate: string | number | null;
  profitability_notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const toIsoString = (value: Date | string) => new Date(value).toISOString();

const toNullableNumber = (value: string | number | null): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const mapProjectRow = (row: ProjectRow): Project => ({
  id: row.id,
  projectName: row.project_name,
  projectEstimatedHrs: toNullableNumber(row.project_estimated_hrs),
  projectStatus: row.project_status ?? "",
  projectCurrency: row.project_currency ?? "",
  projectManager: row.project_manager ?? "",
  projectManagerEmail: row.project_manager_email ?? "",
  projectStartDate: row.project_start_date ?? null,
  projectEndDate: row.project_end_date ?? null,
  projectDescription: row.project_description ?? "",
  budgetHours: toNullableNumber(row.budget_hours),
  budgetCost: toNullableNumber(row.budget_cost),
  expenseBudgetProjectCurrency: toNullableNumber(row.expense_budget),
  projectRegion: row.project_region ?? "",
  poNumber: row.po_number ?? "",
  projectSoldBy: row.project_sold_by ?? "",
  numberOfResources: toNullableNumber(row.number_of_resources),
  numberOfWorkWeeks: toNullableNumber(row.number_of_work_weeks),
  plannedLoeHours: toNullableNumber(row.planned_loe_hours),
  soldAmount: toNullableNumber(row.sold_amount),
  blendedBillRate: toNullableNumber(row.blended_bill_rate),
  blendedCostRate: toNullableNumber(row.blended_cost_rate),
  profitabilityNotes: row.profitability_notes ?? "",
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at)
});

const projectKey = (value: string) => normalizeValue(value).toLowerCase();

const sortProjects = (projects: Project[]) =>
  [...projects].sort((a, b) => a.projectName.localeCompare(b.projectName));

export class PostgresProjectRepository implements ProjectRepository {
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly pool: Pool) {}

  private async ensureSchema() {
    if (!this.schemaReady) {
      this.schemaReady = (async () => {
        await this.pool.query(`
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS planned_loe_hours NUMERIC NULL;
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS sold_amount NUMERIC NULL;
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS blended_bill_rate NUMERIC NULL;
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS blended_cost_rate NUMERIC NULL;
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS profitability_notes TEXT;
          CREATE INDEX IF NOT EXISTS idx_projects_project_start_date ON projects(project_start_date);
          CREATE INDEX IF NOT EXISTS idx_projects_project_end_date ON projects(project_end_date);
        `);
      })();
    }
    await this.schemaReady;
  }

  async getAll(): Promise<Project[]> {
    await this.ensureSchema();
    const result = await this.pool.query<ProjectRow>(`
      SELECT
        id,
        project_name,
        project_estimated_hrs,
        project_status,
        project_currency,
        project_manager,
        project_manager_email,
        project_start_date::text AS project_start_date,
        project_end_date::text AS project_end_date,
        project_description,
        budget_hours,
        budget_cost,
        expense_budget,
        project_region,
        po_number,
        project_sold_by,
        number_of_resources,
        number_of_work_weeks,
        planned_loe_hours,
        sold_amount,
        blended_bill_rate,
        blended_cost_rate,
        profitability_notes,
        created_at,
        updated_at
      FROM projects
      ORDER BY project_name ASC
    `);

    return result.rows.map(mapProjectRow);
  }

  async saveAll(projects: Project[]): Promise<void> {
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM projects");

      for (const record of projects) {
        await client.query(
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
              planned_loe_hours,
              sold_amount,
              blended_bill_rate,
              blended_cost_rate,
              profitability_notes,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
          `,
          [
            record.id,
            record.projectName,
            record.projectEstimatedHrs,
            record.projectStatus,
            record.projectCurrency,
            record.projectManager,
            record.projectManagerEmail,
            record.projectStartDate,
            record.projectEndDate,
            record.projectDescription,
            record.budgetHours,
            record.budgetCost,
            record.expenseBudgetProjectCurrency,
            record.projectRegion,
            record.poNumber,
            record.projectSoldBy,
            record.numberOfResources,
            record.numberOfWorkWeeks,
            record.plannedLoeHours,
            record.soldAmount,
            record.blendedBillRate,
            record.blendedCostRate,
            record.profitabilityNotes,
            record.createdAt,
            record.updatedAt
          ]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async query(filters: ProjectFilters): Promise<PaginatedProjects> {
    const projects = await this.getAll();
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const filtered = sortProjects(projects.filter((project) => matchesProjectFilters(project, filters)));
    const start = (page - 1) * pageSize;

    return {
      data: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize))
    };
  }

  async getById(id: string): Promise<Project | null> {
    await this.ensureSchema();
    const result = await this.pool.query<ProjectRow>(
      `
        SELECT
          id,
          project_name,
          project_estimated_hrs,
          project_status,
          project_currency,
          project_manager,
          project_manager_email,
          project_start_date::text AS project_start_date,
          project_end_date::text AS project_end_date,
          project_description,
          budget_hours,
          budget_cost,
          expense_budget,
          project_region,
          po_number,
          project_sold_by,
          number_of_resources,
          number_of_work_weeks,
          planned_loe_hours,
          sold_amount,
          blended_bill_rate,
          blended_cost_rate,
          profitability_notes,
          created_at,
          updated_at
        FROM projects
        WHERE id = $1
      `,
      [id]
    );

    return result.rows[0] ? mapProjectRow(result.rows[0]) : null;
  }

  async getByName(name: string): Promise<Project | null> {
    const projects = await this.getAll();
    return projects.find((project) => projectKey(project.projectName) === projectKey(name)) ?? null;
  }

  async create(input: ProjectInput): Promise<Project> {
    await this.ensureSchema();
    const created = createProjectRecord(input);
    const result = await this.pool.query<ProjectRow>(
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
          planned_loe_hours,
          sold_amount,
          blended_bill_rate,
          blended_cost_rate,
          profitability_notes,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        RETURNING
          id,
          project_name,
          project_estimated_hrs,
          project_status,
          project_currency,
          project_manager,
          project_manager_email,
          project_start_date::text AS project_start_date,
          project_end_date::text AS project_end_date,
          project_description,
          budget_hours,
          budget_cost,
          expense_budget,
          project_region,
          po_number,
          project_sold_by,
          number_of_resources,
          number_of_work_weeks,
          planned_loe_hours,
          sold_amount,
          blended_bill_rate,
          blended_cost_rate,
          profitability_notes,
          created_at,
          updated_at
      `,
      [
        created.id,
        created.projectName,
        created.projectEstimatedHrs,
        created.projectStatus,
        created.projectCurrency,
        created.projectManager,
        created.projectManagerEmail,
        created.projectStartDate,
        created.projectEndDate,
        created.projectDescription,
        created.budgetHours,
        created.budgetCost,
        created.expenseBudgetProjectCurrency,
        created.projectRegion,
        created.poNumber,
        created.projectSoldBy,
        created.numberOfResources,
        created.numberOfWorkWeeks,
        created.plannedLoeHours,
        created.soldAmount,
        created.blendedBillRate,
        created.blendedCostRate,
        created.profitabilityNotes,
        created.createdAt,
        created.updatedAt
      ]
    );

    return mapProjectRow(result.rows[0]);
  }

  async update(id: string, input: Partial<ProjectInput>): Promise<Project | null> {
    await this.ensureSchema();
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }
    const updated = mergeProjectRecord(existing, input);
    const result = await this.pool.query<ProjectRow>(
      `
        UPDATE projects
        SET
          project_name = $2,
          project_estimated_hrs = $3,
          project_status = $4,
          project_currency = $5,
          project_manager = $6,
          project_manager_email = $7,
          project_start_date = $8,
          project_end_date = $9,
          project_description = $10,
          budget_hours = $11,
          budget_cost = $12,
          expense_budget = $13,
          project_region = $14,
          po_number = $15,
          project_sold_by = $16,
          number_of_resources = $17,
          number_of_work_weeks = $18,
          planned_loe_hours = $19,
          sold_amount = $20,
          blended_bill_rate = $21,
          blended_cost_rate = $22,
          profitability_notes = $23,
          updated_at = $24
        WHERE id = $1
        RETURNING
          id,
          project_name,
          project_estimated_hrs,
          project_status,
          project_currency,
          project_manager,
          project_manager_email,
          project_start_date::text AS project_start_date,
          project_end_date::text AS project_end_date,
          project_description,
          budget_hours,
          budget_cost,
          expense_budget,
          project_region,
          po_number,
          project_sold_by,
          number_of_resources,
          number_of_work_weeks,
          planned_loe_hours,
          sold_amount,
          blended_bill_rate,
          blended_cost_rate,
          profitability_notes,
          created_at,
          updated_at
      `,
      [
        id,
        updated.projectName,
        updated.projectEstimatedHrs,
        updated.projectStatus,
        updated.projectCurrency,
        updated.projectManager,
        updated.projectManagerEmail,
        updated.projectStartDate,
        updated.projectEndDate,
        updated.projectDescription,
        updated.budgetHours,
        updated.budgetCost,
        updated.expenseBudgetProjectCurrency,
        updated.projectRegion,
        updated.poNumber,
        updated.projectSoldBy,
        updated.numberOfResources,
        updated.numberOfWorkWeeks,
        updated.plannedLoeHours,
        updated.soldAmount,
        updated.blendedBillRate,
        updated.blendedCostRate,
        updated.profitabilityNotes,
        updated.updatedAt
      ]
    );
    return mapProjectRow(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM projects WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
