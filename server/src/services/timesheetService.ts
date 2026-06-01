import { stringify } from "csv-stringify/sync";
import {
  createClientRepository,
  createEmployeeRepository,
  createProjectRepository,
  createTimeEntryRepository
} from "../repositories/index.js";
import type { ClientRepository } from "../repositories/ClientRepository.js";
import type { EmployeeRepository } from "../repositories/EmployeeRepository.js";
import type { ProjectRepository } from "../repositories/ProjectRepository.js";
import type { TimeEntryRepository } from "../repositories/TimeEntryRepository.js";
import type {
  Client,
  PaginatedTimeEntries,
  Project,
  SaveWeeklyTimesheetInput,
  TimeEntry,
  TimesheetDayKey,
  TimesheetListFilters,
  TimeEntryEmployeeOption,
  TimeEntryProjectOption,
  TimeEntryFilters,
  TimeEntryInput,
  WeeklyTimesheetDay,
  WeeklyTimesheetResponse,
  WeeklyTimesheetRow,
  WeeklyTimesheetTotals
} from "../types.js";
import { findLikelyClientForProject, isEligibleTimeTrackingProject, matchesTimeEntryFilters, sortTimeEntries } from "../utils/timeEntry.js";
import { normalizeValue } from "../utils/text.js";

const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const satisfies TimesheetDayKey[];
const weekdayLabels: Record<TimesheetDayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun"
};

const roundHours = (value: number) => Number(value.toFixed(2));

const parseDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeMonday = (value: string) => {
  const parsed = parseDate(value);
  if (!parsed) {
    throw new Error("A valid week start date is required.");
  }
  const day = parsed.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  parsed.setUTCDate(parsed.getUTCDate() - offset);
  return parsed.toISOString().slice(0, 10);
};

const addDays = (value: string, days: number) => {
  const parsed = parseDate(value);
  if (!parsed) {
    return value;
  }
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const weekEndFromStart = (weekStart: string) => addDays(weekStart, 6);

const buildWeekDays = (weekStart: string): WeeklyTimesheetDay[] =>
  dayKeys.map((key, index) => ({
    key,
    date: addDays(weekStart, index),
    label: weekdayLabels[key]
  }));

const emptyHours = (): Record<TimesheetDayKey, number> => ({
  mon: 0,
  tue: 0,
  wed: 0,
  thu: 0,
  fri: 0,
  sat: 0,
  sun: 0
});

const emptyTotals = (): WeeklyTimesheetTotals => ({
  ...emptyHours(),
  weeklyTotal: 0,
  billableTotal: 0,
  nonBillableTotal: 0
});

const dayKeyForDate = (date: string): TimesheetDayKey | null => {
  const parsed = parseDate(date);
  if (!parsed) {
    return null;
  }
  const day = parsed.getUTCDay();
  if (day === 1) return "mon";
  if (day === 2) return "tue";
  if (day === 3) return "wed";
  if (day === 4) return "thu";
  if (day === 5) return "fri";
  if (day === 6) return "sat";
  return "sun";
};

const rowKeyForLegacyEntry = (entry: TimeEntry) =>
  [
    entry.projectId,
    entry.clientId ?? "",
    entry.workCategory,
    entry.billable ? "billable" : "non-billable",
    normalizeValue(entry.notes),
    normalizeValue(entry.holidayReason)
  ].join("::");

const buildWeekStatus = (entries: TimeEntry[]): WeeklyTimesheetResponse["status"] => {
  if (!entries.length) {
    return "not-started";
  }
  const statuses = new Set(entries.map((entry) => entry.approvalStatus));
  if (statuses.has("draft")) {
    return "draft";
  }
  if (statuses.has("rejected")) {
    return "rejected";
  }
  if (statuses.has("submitted")) {
    return "submitted";
  }
  if (statuses.has("approved")) {
    return "approved";
  }
  return "draft";
};

export class TimesheetService {
  constructor(
    private readonly repository: TimeEntryRepository = createTimeEntryRepository(),
    private readonly employeeRepository: EmployeeRepository = createEmployeeRepository(),
    private readonly clientRepository: ClientRepository = createClientRepository(),
    private readonly projectRepository: ProjectRepository = createProjectRepository()
  ) {}

  async getEmployeeOptions(): Promise<TimeEntryEmployeeOption[]> {
    const employees = await this.employeeRepository.getAll();
    return employees
      .map((employee) => ({
        id: employee.id,
        fullName: employee.fullName,
        email: employee.email,
        title: employee.title,
        employeeRegion: employee.employeeRegion,
        supervisorName: employee.supervisorName
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async getClientOptions(): Promise<Array<{ id: string; clientName: string; clientManager: string }>> {
    const clients = await this.clientRepository.getAll();
    return clients
      .map((client) => ({
        id: client.id,
        clientName: client.clientName,
        clientManager: client.clientManager
      }))
      .sort((a, b) => a.clientName.localeCompare(b.clientName));
  }

  async getProjectOptions(filters: { clientId?: string; search?: string; recentOnly?: boolean } = {}): Promise<TimeEntryProjectOption[]> {
    const [projects, clients] = await Promise.all([this.projectRepository.getAll(), this.clientRepository.getAll()]);
    const search = normalizeValue(filters.search).toLowerCase();
    const recentOnly = filters.recentOnly ?? true;

    return projects
      .filter((project) => (recentOnly ? isEligibleTimeTrackingProject(project) : true))
      .map((project) => {
        const client = findLikelyClientForProject(project, clients);
        return {
          id: project.id,
          projectName: project.projectName,
          clientId: client?.id ?? null,
          clientName: client?.clientName ?? "",
          projectStatus: project.projectStatus,
          projectManager: project.projectManager,
          projectStartDate: project.projectStartDate,
          projectEndDate: project.projectEndDate,
          projectRegion: project.projectRegion,
          budgetHours: project.budgetHours,
          budgetCost: project.budgetCost,
          plannedLoeHours: project.plannedLoeHours ?? project.budgetHours,
          actualLoeHours: undefined,
          remainingLoeHours: undefined,
          loeUsedPercent: undefined,
          soldAmount: project.soldAmount ?? project.budgetCost,
          actualCost: undefined,
          marginPercent: undefined,
          profitabilityStatus: undefined,
          assignedEmployeeCount: undefined,
          label: [project.projectName, client?.clientName, project.projectManager, project.projectStatus].filter(Boolean).join(" — ")
        };
      })
      .filter((option) => (filters.clientId ? option.clientId === filters.clientId : true))
      .filter((option) => {
        if (!search) return true;
        return [option.projectName, option.clientName, option.projectManager, option.projectStatus]
          .join(" ")
          .toLowerCase()
          .includes(search);
      })
      .sort((a, b) => a.projectName.localeCompare(b.projectName));
  }

  async getWeek(employeeId: string, weekStartInput: string): Promise<WeeklyTimesheetResponse> {
    const weekStart = normalizeMonday(weekStartInput);
    const weekEnd = weekEndFromStart(weekStart);
    const [employee, entries] = await Promise.all([
      this.employeeRepository.getById(employeeId),
      this.getEntriesForEmployeeWeek(employeeId, weekStart)
    ]);

    if (!employee) {
      throw new Error("Selected employee was not found.");
    }

    const groupedRows = new Map<string, WeeklyTimesheetRow>();
    for (const entry of entries) {
      const rowKey = entry.rowGroupId ?? rowKeyForLegacyEntry(entry);
      const dayKey = dayKeyForDate(entry.workDate);
      if (!dayKey) {
        continue;
      }
      const existing =
        groupedRows.get(rowKey) ??
        {
          rowGroupId: entry.rowGroupId ?? crypto.randomUUID(),
          clientId: entry.clientId,
          clientName: entry.clientName,
          projectId: entry.projectId,
          projectName: entry.projectName,
          workCategory: entry.workCategory,
          billable: entry.billable,
          notes: entry.notes,
          holidayOrWeekendReason: entry.holidayReason,
          hours: emptyHours()
        };

      existing.hours[dayKey] = roundHours(existing.hours[dayKey] + entry.hours);
      existing.holidayOrWeekendReason = existing.holidayOrWeekendReason || entry.holidayReason;
      groupedRows.set(rowKey, existing);
    }

    const rows = Array.from(groupedRows.values());
    const totals = rows.reduce<WeeklyTimesheetTotals>((acc, row) => {
      for (const key of dayKeys) {
        acc[key] = roundHours(acc[key] + (row.hours[key] ?? 0));
      }
      const rowTotal = dayKeys.reduce((sum, key) => sum + (row.hours[key] ?? 0), 0);
      acc.weeklyTotal = roundHours(acc.weeklyTotal + rowTotal);
      if (row.billable) {
        acc.billableTotal = roundHours(acc.billableTotal + rowTotal);
      } else {
        acc.nonBillableTotal = roundHours(acc.nonBillableTotal + rowTotal);
      }
      return acc;
    }, emptyTotals());

    const showWeekend = rows.some((row) => (row.hours.sat ?? 0) > 0 || (row.hours.sun ?? 0) > 0);

    return {
      employeeId,
      employeeName: employee.fullName,
      weekStart,
      weekEnd,
      status: buildWeekStatus(entries),
      showWeekend,
      days: buildWeekDays(weekStart),
      rows,
      totals
    };
  }

  async saveWeek(input: SaveWeeklyTimesheetInput): Promise<WeeklyTimesheetResponse> {
    const weekStart = normalizeMonday(input.weekStart);
    const weekEnd = weekEndFromStart(weekStart);
    await this.validateWeekInput(input, weekStart);

    const existingEntries = await this.getEntriesForEmployeeWeek(input.employeeId, weekStart);
    for (const entry of existingEntries) {
      await this.repository.delete(entry.id);
    }

    for (const row of input.rows) {
      const normalizedHours = this.normalizeRowHours(row.hours);
      const rowTotal = dayKeys.reduce((sum, key) => sum + normalizedHours[key], 0);
      if (rowTotal <= 0) {
        continue;
      }

      const rowGroupId = row.rowGroupId ?? crypto.randomUUID();
      for (const key of dayKeys) {
        const hours = normalizedHours[key];
        if (hours <= 0) {
          continue;
        }
        const workDate = addDays(weekStart, dayKeys.indexOf(key));
        const entryInput: TimeEntryInput = {
          employeeId: input.employeeId,
          clientId: row.clientId ?? null,
          projectId: row.projectId,
          workDate,
          timesheetWeekStart: weekStart,
          rowGroupId,
          hours,
          workCategory: row.workCategory,
          billable: row.billable,
          approvalStatus: input.status === "submitted" ? "submitted" : "draft",
          locked: false,
          source: "timesheet",
          notes: row.notes,
          holidayReason: row.holidayOrWeekendReason
        };
        await this.repository.create(entryInput);
      }
    }

    return this.getWeek(input.employeeId, weekStart);
  }

  async submitWeek(employeeId: string, weekStartInput: string): Promise<WeeklyTimesheetResponse> {
    const weekStart = normalizeMonday(weekStartInput);
    const entries = await this.getEntriesForEmployeeWeek(employeeId, weekStart);
    if (!entries.length) {
      throw new Error("No saved entries exist for that week.");
    }

    for (const entry of entries) {
      await this.repository.update(entry.id, {
        approvalStatus: "submitted"
      });
    }

    return this.getWeek(employeeId, weekStart);
  }

  async copyPreviousWeek(employeeId: string, targetWeekStartInput: string): Promise<WeeklyTimesheetResponse> {
    const targetWeekStart = normalizeMonday(targetWeekStartInput);
    const previousWeekStart = addDays(targetWeekStart, -7);
    const previousWeek = await this.getWeek(employeeId, previousWeekStart);

    return {
      ...previousWeek,
      weekStart: targetWeekStart,
      weekEnd: weekEndFromStart(targetWeekStart),
      status: "draft",
      days: buildWeekDays(targetWeekStart),
      rows: previousWeek.rows.map((row) => ({
        ...row,
        rowGroupId: crypto.randomUUID(),
        hours: emptyHours()
      })),
      totals: emptyTotals()
    };
  }

  async list(filters: TimesheetListFilters): Promise<PaginatedTimeEntries> {
    const mappedFilters: TimeEntryFilters = {
      employeeId: filters.employeeId,
      clientId: filters.clientId,
      projectId: filters.projectId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      billable: filters.billable,
      approvalStatus: filters.status,
      search: filters.search,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 25,
      sortBy: "workDate",
      sortDirection: "desc"
    };

    const [entries, employees, clients, projects] = await Promise.all([
      this.repository.getAll(),
      this.employeeRepository.getAll(),
      this.clientRepository.getAll(),
      this.projectRepository.getAll()
    ]);

    const enriched = this.enrichEntries(entries, employees, clients, projects);
    const filtered = sortTimeEntries(
      enriched.filter((entry) => matchesTimeEntryFilters(entry, mappedFilters)),
      mappedFilters.sortBy,
      mappedFilters.sortDirection
    );
    const page = mappedFilters.page ?? 1;
    const pageSize = mappedFilters.pageSize ?? 25;
    const start = (page - 1) * pageSize;

    return {
      data: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize))
    };
  }

  async exportWeek(employeeId: string, weekStartInput: string): Promise<string> {
    const week = await this.getWeek(employeeId, weekStartInput);
    return stringify(
      week.rows.map((row) => ({
        employeeName: week.employeeName,
        weekStart: week.weekStart,
        clientName: row.clientName,
        projectName: row.projectName,
        workCategory: row.workCategory,
        billable: row.billable ? "true" : "false",
        notes: row.notes,
        monday: row.hours.mon,
        tuesday: row.hours.tue,
        wednesday: row.hours.wed,
        thursday: row.hours.thu,
        friday: row.hours.fri,
        saturday: row.hours.sat,
        sunday: row.hours.sun,
        total: roundHours(dayKeys.reduce((sum, key) => sum + (row.hours[key] ?? 0), 0))
      })),
      { header: true }
    );
  }

  private async validateWeekInput(input: SaveWeeklyTimesheetInput, weekStart: string) {
    const [employee, clients, projects] = await Promise.all([
      this.employeeRepository.getById(input.employeeId),
      this.clientRepository.getAll(),
      this.projectRepository.getAll()
    ]);

    if (!employee) {
      throw new Error("Selected employee was not found.");
    }

    const clientIds = new Set(clients.map((client) => client.id));
    const projectIds = new Set(projects.map((project) => project.id));

    for (const row of input.rows) {
      const normalizedHours = this.normalizeRowHours(row.hours);
      const rowTotal = dayKeys.reduce((sum, key) => sum + normalizedHours[key], 0);
      if (rowTotal <= 0) {
        continue;
      }
      if (!row.projectId || !projectIds.has(row.projectId)) {
        throw new Error("Each non-empty timesheet row must use a valid project.");
      }
      if (row.clientId && !clientIds.has(row.clientId)) {
        throw new Error("A selected client was not found.");
      }
      if (row.notes.length > 1000) {
        throw new Error("Notes must be 1000 characters or fewer.");
      }
      if (row.holidayOrWeekendReason.length > 1000) {
        throw new Error("Weekend / holiday reason must be 1000 characters or fewer.");
      }
    }
  }

  private normalizeRowHours(hours: Partial<Record<TimesheetDayKey, number>>) {
    const normalized = emptyHours();
    for (const key of dayKeys) {
      const value = Number(hours[key] ?? 0);
      if (!Number.isFinite(value) || value < 0 || value > 24) {
        throw new Error("Daily hours must be between 0 and 24.");
      }
      normalized[key] = roundHours(value);
    }
    return normalized;
  }

  private async getEntriesForEmployeeWeek(employeeId: string, weekStart: string): Promise<TimeEntry[]> {
    const weekEnd = weekEndFromStart(weekStart);
    const [entries, employees, clients, projects] = await Promise.all([
      this.repository.getAll(),
      this.employeeRepository.getAll(),
      this.clientRepository.getAll(),
      this.projectRepository.getAll()
    ]);

    return this.enrichEntries(entries, employees, clients, projects).filter((entry) => {
      const entryWeek = entry.timesheetWeekStart ?? normalizeMonday(entry.workDate);
      return entry.employeeId === employeeId && entryWeek === weekStart && entry.workDate >= weekStart && entry.workDate <= weekEnd;
    });
  }

  private enrichEntries(entries: TimeEntry[], employees: Awaited<ReturnType<EmployeeRepository["getAll"]>>, clients: Client[], projects: Project[]) {
    return entries.map((entry) => {
      const employee = employees.find((candidate) => candidate.id === entry.employeeId);
      const project = projects.find((candidate) => candidate.id === entry.projectId);
      const client =
        clients.find((candidate) => candidate.id === entry.clientId) ??
        (project ? findLikelyClientForProject(project, clients) : null);

      return {
        ...entry,
        employeeName: employee?.fullName ?? entry.employeeName,
        employeeEmail: employee?.email ?? entry.employeeEmail,
        clientId: client?.id ?? entry.clientId,
        clientName: client?.clientName ?? entry.clientName,
        projectName: project?.projectName ?? entry.projectName,
        projectStatus: project?.projectStatus ?? entry.projectStatus,
        projectManager: project?.projectManager ?? entry.projectManager
      };
    });
  }
}
