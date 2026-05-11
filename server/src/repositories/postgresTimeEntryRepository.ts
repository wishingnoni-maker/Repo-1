import type { Pool } from "pg";
import type {
  PaginatedTimeEntries,
  TimeEntry,
  TimeEntryFilters,
  TimeEntryInput
} from "../types.js";
import { matchesTimeEntryFilters, sortTimeEntries } from "../utils/timeEntry.js";
import type { TimeEntryRepository } from "./TimeEntryRepository.js";

type TimeEntryRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string | null;
  client_id: string | null;
  client_name: string | null;
  project_id: string;
  project_name: string;
  project_status: string | null;
  project_manager: string | null;
  work_date: string;
  hours: string | number;
  work_category: string;
  billable: boolean;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const toIsoString = (value: Date | string) => new Date(value).toISOString();

const mapTimeEntryRow = (row: TimeEntryRow): TimeEntry => ({
  id: row.id,
  employeeId: row.employee_id,
  employeeName: row.employee_name,
  employeeEmail: row.employee_email ?? "",
  clientId: row.client_id,
  clientName: row.client_name ?? "",
  projectId: row.project_id,
  projectName: row.project_name,
  projectStatus: row.project_status ?? "",
  projectManager: row.project_manager ?? "",
  workDate: row.work_date,
  hours: Number(row.hours),
  workCategory: row.work_category,
  billable: row.billable,
  notes: row.notes ?? "",
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at)
});

const joinedSelect = `
  SELECT
    te.id,
    te.employee_id,
    e.full_name AS employee_name,
    e.email AS employee_email,
    te.client_id,
    c.client_name,
    te.project_id,
    p.project_name,
    p.project_status,
    p.project_manager,
    te.work_date::text AS work_date,
    te.hours,
    te.work_category,
    te.billable,
    te.notes,
    te.created_at,
    te.updated_at
  FROM time_entries te
  JOIN employees e ON e.id = te.employee_id
  JOIN projects p ON p.id = te.project_id
  LEFT JOIN clients c ON c.id = te.client_id
`;

export class PostgresTimeEntryRepository implements TimeEntryRepository {
  constructor(private readonly pool: Pool) {}

  async getAll(): Promise<TimeEntry[]> {
    const result = await this.pool.query<TimeEntryRow>(`
      ${joinedSelect}
      ORDER BY te.work_date DESC, te.created_at DESC
    `);

    return result.rows.map(mapTimeEntryRow);
  }

  async query(filters: TimeEntryFilters): Promise<PaginatedTimeEntries> {
    const entries = await this.getAll();
    const filtered = sortTimeEntries(
      entries.filter((entry) => matchesTimeEntryFilters(entry, filters)),
      filters.sortBy,
      filters.sortDirection
    );
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const start = (page - 1) * pageSize;

    return {
      data: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize))
    };
  }

  async getById(id: string): Promise<TimeEntry | null> {
    const result = await this.pool.query<TimeEntryRow>(
      `
        ${joinedSelect}
        WHERE te.id = $1
      `,
      [id]
    );

    return result.rows[0] ? mapTimeEntryRow(result.rows[0]) : null;
  }

  async create(input: TimeEntryInput): Promise<TimeEntry> {
    const result = await this.pool.query(
      `
        INSERT INTO time_entries (
          employee_id,
          project_id,
          client_id,
          work_date,
          hours,
          work_category,
          billable,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
      [
        input.employeeId,
        input.projectId,
        input.clientId,
        input.workDate,
        input.hours,
        input.workCategory,
        input.billable,
        input.notes
      ]
    );

    return (await this.getById(result.rows[0].id)) as TimeEntry;
  }

  async update(id: string, input: Partial<TimeEntryInput>): Promise<TimeEntry | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const merged = {
      employeeId: input.employeeId ?? existing.employeeId,
      projectId: input.projectId ?? existing.projectId,
      clientId: input.clientId !== undefined ? input.clientId : existing.clientId,
      workDate: input.workDate ?? existing.workDate,
      hours: input.hours ?? existing.hours,
      workCategory: input.workCategory ?? existing.workCategory,
      billable: input.billable ?? existing.billable,
      notes: input.notes ?? existing.notes
    };

    await this.pool.query(
      `
        UPDATE time_entries
        SET
          employee_id = $2,
          project_id = $3,
          client_id = $4,
          work_date = $5,
          hours = $6,
          work_category = $7,
          billable = $8,
          notes = $9
        WHERE id = $1
      `,
      [
        id,
        merged.employeeId,
        merged.projectId,
        merged.clientId,
        merged.workDate,
        merged.hours,
        merged.workCategory,
        merged.billable,
        merged.notes
      ]
    );

    return this.getById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM time_entries WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
