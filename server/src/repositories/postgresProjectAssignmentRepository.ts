import type { Pool } from "pg";
import type { ProjectAssignment, ProjectAssignmentInput } from "../types.js";
import type { ProjectAssignmentRepository } from "./ProjectAssignmentRepository.js";

type AssignmentRow = {
  id: string;
  project_id: string;
  employee_id: string;
  employee_name: string | null;
  employee_email: string | null;
  employee_title: string | null;
  employee_region: string | null;
  role_on_project: string | null;
  planned_hours: string | number | null;
  bill_rate: string | number | null;
  cost_rate: string | number | null;
  allocation_percent: string | number | null;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
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

const joinedSelect = `
  SELECT
    pa.id,
    pa.project_id,
    pa.employee_id,
    e.full_name AS employee_name,
    e.email AS employee_email,
    e.title AS employee_title,
    e.employee_region AS employee_region,
    pa.role_on_project,
    pa.planned_hours,
    pa.bill_rate,
    pa.cost_rate,
    pa.allocation_percent,
    pa.start_date::text AS start_date,
    pa.end_date::text AS end_date,
    pa.active,
    pa.created_at,
    pa.updated_at
  FROM project_assignments pa
  JOIN employees e ON e.id = pa.employee_id
`;

const mapRow = (row: AssignmentRow): ProjectAssignment => ({
  id: row.id,
  projectId: row.project_id,
  employeeId: row.employee_id,
  employeeName: row.employee_name ?? "",
  employeeEmail: row.employee_email ?? "",
  employeeTitle: row.employee_title ?? "",
  employeeRegion: row.employee_region ?? "",
  roleOnProject: row.role_on_project ?? "",
  plannedHours: toNullableNumber(row.planned_hours),
  billRate: toNullableNumber(row.bill_rate),
  costRate: toNullableNumber(row.cost_rate),
  allocationPercent: toNullableNumber(row.allocation_percent),
  startDate: row.start_date ?? null,
  endDate: row.end_date ?? null,
  active: row.active,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at)
});

export class PostgresProjectAssignmentRepository implements ProjectAssignmentRepository {
  constructor(private readonly pool: Pool) {}

  async getAll(): Promise<ProjectAssignment[]> {
    const result = await this.pool.query<AssignmentRow>(`${joinedSelect} ORDER BY pa.created_at DESC`);
    return result.rows.map(mapRow);
  }

  async getById(id: string): Promise<ProjectAssignment | null> {
    const result = await this.pool.query<AssignmentRow>(`${joinedSelect} WHERE pa.id = $1`, [id]);
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async getByProjectId(projectId: string): Promise<ProjectAssignment[]> {
    const result = await this.pool.query<AssignmentRow>(
      `${joinedSelect} WHERE pa.project_id = $1 ORDER BY pa.active DESC, e.full_name ASC`,
      [projectId]
    );
    return result.rows.map(mapRow);
  }

  async create(input: ProjectAssignmentInput): Promise<ProjectAssignment> {
    const result = await this.pool.query<{ id: string }>(
      `
        INSERT INTO project_assignments (
          project_id,
          employee_id,
          role_on_project,
          planned_hours,
          bill_rate,
          cost_rate,
          allocation_percent,
          start_date,
          end_date,
          active
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id
      `,
      [
        input.projectId,
        input.employeeId,
        input.roleOnProject,
        input.plannedHours,
        input.billRate,
        input.costRate,
        input.allocationPercent,
        input.startDate,
        input.endDate,
        input.active
      ]
    );
    return (await this.getById(result.rows[0].id)) as ProjectAssignment;
  }

  async update(id: string, input: Partial<ProjectAssignmentInput>): Promise<ProjectAssignment | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const merged = {
      projectId: input.projectId ?? existing.projectId,
      employeeId: input.employeeId ?? existing.employeeId,
      roleOnProject: input.roleOnProject ?? existing.roleOnProject,
      plannedHours: input.plannedHours !== undefined ? input.plannedHours : existing.plannedHours,
      billRate: input.billRate !== undefined ? input.billRate : existing.billRate,
      costRate: input.costRate !== undefined ? input.costRate : existing.costRate,
      allocationPercent:
        input.allocationPercent !== undefined ? input.allocationPercent : existing.allocationPercent,
      startDate: input.startDate !== undefined ? input.startDate : existing.startDate,
      endDate: input.endDate !== undefined ? input.endDate : existing.endDate,
      active: input.active ?? existing.active
    };

    await this.pool.query(
      `
        UPDATE project_assignments
        SET
          project_id = $2,
          employee_id = $3,
          role_on_project = $4,
          planned_hours = $5,
          bill_rate = $6,
          cost_rate = $7,
          allocation_percent = $8,
          start_date = $9,
          end_date = $10,
          active = $11
        WHERE id = $1
      `,
      [
        id,
        merged.projectId,
        merged.employeeId,
        merged.roleOnProject,
        merged.plannedHours,
        merged.billRate,
        merged.costRate,
        merged.allocationPercent,
        merged.startDate,
        merged.endDate,
        merged.active
      ]
    );

    return this.getById(id);
  }

  async deactivate(id: string): Promise<ProjectAssignment | null> {
    return this.update(id, { active: false });
  }
}
