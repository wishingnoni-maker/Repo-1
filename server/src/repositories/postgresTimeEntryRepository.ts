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
  timesheet_week_start: string | null;
  row_group_id: string | null;
  hours: string | number;
  work_category: string;
  billable: boolean;
  approval_status: "draft" | "submitted" | "approved" | "rejected";
  locked: boolean;
  source: string;
  notes: string | null;
  holiday_reason: string | null;
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
  timesheetWeekStart: row.timesheet_week_start,
  rowGroupId: row.row_group_id,
  hours: Number(row.hours),
  workCategory: row.work_category,
  billable: row.billable,
  approvalStatus: row.approval_status,
  locked: row.locked,
  source: row.source,
  notes: row.notes ?? "",
  holidayReason: row.holiday_reason ?? "",
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
    te.timesheet_week_start::text AS timesheet_week_start,
    te.row_group_id::text AS row_group_id,
    te.hours,
    te.work_category,
    te.billable,
    te.approval_status,
    te.locked,
    te.source,
    te.notes,
    te.holiday_reason,
    te.created_at,
    te.updated_at
  FROM time_entries te
  JOIN employees e ON e.id = te.employee_id
  JOIN projects p ON p.id = te.project_id
  LEFT JOIN clients c ON c.id = te.client_id
`;

export class PostgresTimeEntryRepository implements TimeEntryRepository {
  private schemaReady: Promise<void> | null = null;

  constructor(private readonly pool: Pool) {}

  private async ensureSchema() {
    if (!this.schemaReady) {
      this.schemaReady = (async () => {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS time_entries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            client_id UUID NULL REFERENCES clients(id) ON DELETE SET NULL,
            work_date DATE NOT NULL,
            timesheet_week_start DATE NULL,
            row_group_id UUID NULL,
            hours NUMERIC(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
            work_category TEXT NOT NULL DEFAULT 'Client Work',
            billable BOOLEAN NOT NULL DEFAULT TRUE,
            approval_status TEXT NOT NULL DEFAULT 'submitted',
            locked BOOLEAN NOT NULL DEFAULT FALSE,
            source TEXT NOT NULL DEFAULT 'manual',
            notes TEXT,
            holiday_reason TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS client_id UUID NULL;
          ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS work_category TEXT NOT NULL DEFAULT 'Client Work';
          ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS billable BOOLEAN NOT NULL DEFAULT TRUE;
          ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS notes TEXT;
          ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'submitted';
          ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;
          ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
          ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
          ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
          ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS timesheet_week_start DATE NULL;
          ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS row_group_id UUID NULL;
          ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS holiday_reason TEXT;
          CREATE INDEX IF NOT EXISTS idx_time_entries_employee_id ON time_entries(employee_id);
          CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id);
          CREATE INDEX IF NOT EXISTS idx_time_entries_client_id ON time_entries(client_id);
          CREATE INDEX IF NOT EXISTS idx_time_entries_work_date ON time_entries(work_date);
          CREATE INDEX IF NOT EXISTS idx_time_entries_billable ON time_entries(billable);
          CREATE INDEX IF NOT EXISTS idx_time_entries_created_at ON time_entries(created_at);
          CREATE INDEX IF NOT EXISTS idx_time_entries_approval_status ON time_entries(approval_status);
          CREATE INDEX IF NOT EXISTS idx_time_entries_timesheet_week_start ON time_entries(timesheet_week_start);
          CREATE INDEX IF NOT EXISTS idx_time_entries_row_group_id ON time_entries(row_group_id);
        `);
      })();
    }
    await this.schemaReady;
  }

  async getAll(): Promise<TimeEntry[]> {
    await this.ensureSchema();
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
    await this.ensureSchema();
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
    await this.ensureSchema();
    const result = await this.pool.query(
      `
        INSERT INTO time_entries (
          employee_id,
          project_id,
          client_id,
          work_date,
          timesheet_week_start,
          row_group_id,
          hours,
          work_category,
          billable,
          approval_status,
          locked,
          source,
          notes,
          holiday_reason
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
      `,
      [
        input.employeeId,
        input.projectId,
        input.clientId,
        input.workDate,
        input.timesheetWeekStart,
        input.rowGroupId,
        input.hours,
        input.workCategory,
        input.billable,
        input.approvalStatus,
        input.locked,
        input.source,
        input.notes,
        input.holidayReason
      ]
    );

    return (await this.getById(result.rows[0].id)) as TimeEntry;
  }

  async update(id: string, input: Partial<TimeEntryInput>): Promise<TimeEntry | null> {
    await this.ensureSchema();
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const merged = {
      employeeId: input.employeeId ?? existing.employeeId,
      projectId: input.projectId ?? existing.projectId,
      clientId: input.clientId !== undefined ? input.clientId : existing.clientId,
      workDate: input.workDate ?? existing.workDate,
      timesheetWeekStart:
        input.timesheetWeekStart !== undefined ? input.timesheetWeekStart : existing.timesheetWeekStart,
      rowGroupId: input.rowGroupId !== undefined ? input.rowGroupId : existing.rowGroupId,
      hours: input.hours ?? existing.hours,
      workCategory: input.workCategory ?? existing.workCategory,
      billable: input.billable ?? existing.billable,
      approvalStatus: input.approvalStatus ?? existing.approvalStatus,
      locked: input.locked ?? existing.locked,
      source: input.source ?? existing.source,
      notes: input.notes ?? existing.notes,
      holidayReason: input.holidayReason ?? existing.holidayReason
    };

    await this.pool.query(
      `
        UPDATE time_entries
        SET
          employee_id = $2,
          project_id = $3,
          client_id = $4,
          work_date = $5,
          timesheet_week_start = $6,
          row_group_id = $7,
          hours = $8,
          work_category = $9,
          billable = $10,
          approval_status = $11,
          locked = $12,
          source = $13,
          notes = $14,
          holiday_reason = $15
        WHERE id = $1
      `,
      [
        id,
        merged.employeeId,
        merged.projectId,
        merged.clientId,
        merged.workDate,
        merged.timesheetWeekStart,
        merged.rowGroupId,
        merged.hours,
        merged.workCategory,
        merged.billable,
        merged.approvalStatus,
        merged.locked,
        merged.source,
        merged.notes,
        merged.holidayReason
      ]
    );

    return this.getById(id);
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureSchema();
    const result = await this.pool.query("DELETE FROM time_entries WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
