import {
  createClientRepository,
  createEmployeeRepository,
  createProjectAssignmentRepository,
  createProjectRepository,
  createTimeEntryRepository
} from "../repositories/index.js";
import type { ClientRepository } from "../repositories/ClientRepository.js";
import type { EmployeeRepository } from "../repositories/EmployeeRepository.js";
import type { ProjectAssignmentRepository } from "../repositories/ProjectAssignmentRepository.js";
import type { ProjectRepository } from "../repositories/ProjectRepository.js";
import type { TimeEntryRepository } from "../repositories/TimeEntryRepository.js";
import type {
  Client,
  Project,
  ProjectAssignment,
  TimeEntry,
  TimeEntryEmployeeOption,
  TimeEntryProjectOption,
  TimeTrackingDashboard,
  TimeTrackingProjectDetail,
  TimeTrackingProjectFilters,
  TimeTrackingProjectRow
} from "../types.js";
import { projectFinancialsToCsv, timeEntriesToCsv } from "./exportService.js";
import { findLikelyClientForProject, isEligibleTimeTrackingProject } from "../utils/timeEntry.js";
import { normalizeValue } from "../utils/text.js";

const round = (value: number | null) => (value == null ? null : Number(value.toFixed(2)));
const asNumber = (value: number | null | undefined) => (value == null ? 0 : value);
const startOfWeek = () => {
  const value = new Date();
  const day = value.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  value.setUTCDate(value.getUTCDate() - offset);
  return value.toISOString().slice(0, 10);
};
const startOfMonth = () => {
  const value = new Date();
  value.setUTCDate(1);
  return value.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

const profitabilityStatus = (marginPercent: number | null, loeUsedPercent: number | null) => {
  if (marginPercent == null) {
    return "Unknown" as const;
  }
  if (marginPercent < 0) {
    return "Unprofitable" as const;
  }
  if (loeUsedPercent != null && loeUsedPercent > 100) {
    return "At Risk" as const;
  }
  if (marginPercent < 15 || (loeUsedPercent != null && loeUsedPercent >= 90)) {
    return "At Risk" as const;
  }
  if (marginPercent < 30) {
    return "Healthy" as const;
  }
  return "Great" as const;
};

const groupValues = <T>(
  rows: T[],
  keyOf: (row: T) => string,
  valueOf: (row: T) => number
) =>
  Array.from(
    rows.reduce((map, row) => {
      const key = keyOf(row) || "Unassigned";
      map.set(key, (map.get(key) ?? 0) + valueOf(row));
      return map;
    }, new Map<string, number>())
  )
    .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

const toWeekLabel = (workDate: string) => {
  const parsed = new Date(workDate);
  if (Number.isNaN(parsed.getTime())) {
    return workDate;
  }
  const day = parsed.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  parsed.setUTCDate(parsed.getUTCDate() - offset);
  return parsed.toISOString().slice(0, 10);
};

const withinRange = (value: string | null, start?: string, end?: string) => {
  if (!value) return false;
  if (start && value < start) return false;
  if (end && value > end) return false;
  return true;
};

export class TimeTrackingService {
  constructor(
    private readonly employeeRepository: EmployeeRepository = createEmployeeRepository(),
    private readonly clientRepository: ClientRepository = createClientRepository(),
    private readonly projectRepository: ProjectRepository = createProjectRepository(),
    private readonly timeEntryRepository: TimeEntryRepository = createTimeEntryRepository(),
    private readonly assignmentRepository: ProjectAssignmentRepository = createProjectAssignmentRepository()
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

  async getProjectOptions(): Promise<TimeEntryProjectOption[]> {
    const rows = await this.getProjectRows({ lastFiveYearsOnly: true });
    return rows
      .filter((row) => row.projectStatus || row.projectStartDate || row.projectEndDate)
      .map((row) => ({
        id: row.projectId,
        projectName: row.projectName,
        clientId: row.clientId,
        clientName: row.clientName,
        projectStatus: row.projectStatus,
        projectManager: row.projectManager,
        projectStartDate: row.projectStartDate,
        projectEndDate: row.projectEndDate,
        projectRegion: "",
        budgetHours: row.plannedLoeHours,
        budgetCost: row.soldAmount,
        plannedLoeHours: row.plannedLoeHours,
        actualLoeHours: row.actualLoeHours,
        remainingLoeHours: row.remainingLoeHours,
        loeUsedPercent: row.loeUsedPercent,
        soldAmount: row.soldAmount,
        actualCost: row.actualCost,
        marginPercent: row.marginPercent,
        profitabilityStatus: row.profitabilityStatus,
        assignedEmployeeCount: row.assignedEmployeeCount,
        label: [
          row.projectName,
          row.clientName,
          row.loeUsedPercent == null ? null : `${row.loeUsedPercent.toFixed(1)}% LOE used`,
          row.profitabilityStatus
        ]
          .filter(Boolean)
          .join(" — ")
      }));
  }

  async getDashboard(): Promise<TimeTrackingDashboard> {
    const [entries, projects] = await Promise.all([this.timeEntryRepository.getAll(), this.getProjectRows({})]);
    const weekStart = startOfWeek();
    const monthStart = startOfMonth();
    const totalHoursThisWeek = Number(
      entries.filter((entry) => withinRange(entry.workDate, weekStart, today())).reduce((sum, entry) => sum + entry.hours, 0).toFixed(2)
    );
    const monthEntries = entries.filter((entry) => withinRange(entry.workDate, monthStart, today()));
    const totalHoursThisMonth = Number(monthEntries.reduce((sum, entry) => sum + entry.hours, 0).toFixed(2));
    const billableHoursThisMonth = Number(monthEntries.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.hours, 0).toFixed(2));
    const nonBillableHoursThisMonth = Number(monthEntries.filter((entry) => !entry.billable).reduce((sum, entry) => sum + entry.hours, 0).toFixed(2));
    const totalSoldAmount = round(projects.reduce((sum, project) => sum + asNumber(project.soldAmount), 0));
    const estimatedActualCost = round(projects.reduce((sum, project) => sum + asNumber(project.actualCost), 0));
    const estimatedProfit =
      totalSoldAmount != null && estimatedActualCost != null ? round(totalSoldAmount - estimatedActualCost) : null;
    const projectsWithMargin = projects.filter((project) => project.marginPercent != null);
    const averageMarginPercent = projectsWithMargin.length
      ? round(projectsWithMargin.reduce((sum, project) => sum + asNumber(project.marginPercent), 0) / projectsWithMargin.length)
      : null;

    return {
      totalHoursThisWeek,
      totalHoursThisMonth,
      billableHoursThisMonth,
      nonBillableHoursThisMonth,
      activeProjectsWithTime: projects.filter((project) => project.actualLoeHours > 0).length,
      projectsAtRisk: projects.filter((project) => ["At Risk", "Unprofitable"].includes(project.profitabilityStatus)).length,
      totalSoldAmount,
      estimatedActualCost,
      estimatedProfit,
      averageMarginPercent,
      topProjectsByHours: groupValues(projects.filter((project) => project.actualLoeHours > 0), (project) => project.projectName, (project) => project.actualLoeHours).slice(0, 8).map((row) => ({
        ...row,
        projectId: projects.find((project) => project.projectName === row.label)?.projectId ?? null
      })),
      topEmployeesByHours: groupValues(entries, (entry) => entry.employeeName, (entry) => entry.hours).slice(0, 8).map((row) => ({
        ...row,
        employeeId: entries.find((entry) => entry.employeeName === row.label)?.employeeId ?? null
      })),
      recentEntries: [...entries].sort((a, b) => b.workDate.localeCompare(a.workDate) || b.createdAt.localeCompare(a.createdAt)).slice(0, 10)
    };
  }

  async getProjectRows(filters: TimeTrackingProjectFilters): Promise<TimeTrackingProjectRow[]> {
    const refs = await this.getReferenceData();
    let rows = refs.projects.map((project) => this.buildProjectRow(project, refs.clients, refs.assignments, refs.entries));

    rows = rows.filter((row) => this.matchesFilters(row, filters));
    if (filters.lastFiveYearsOnly) {
      const eligibleIds = new Set(refs.projects.filter((project) => isEligibleTimeTrackingProject(project)).map((project) => project.id));
      rows = rows.filter((row) => eligibleIds.has(row.projectId));
    }

    return rows.sort((a, b) => a.projectName.localeCompare(b.projectName));
  }

  async getProjectDetail(projectId: string): Promise<TimeTrackingProjectDetail | null> {
    const refs = await this.getReferenceData();
    const project = refs.projects.find((candidate) => candidate.id === projectId);
    if (!project) {
      return null;
    }
    const row = this.buildProjectRow(project, refs.clients, refs.assignments, refs.entries);
    const assignments = refs.assignments.filter((assignment) => assignment.projectId === projectId);
    const timeEntries = refs.entries
      .filter((entry) => entry.projectId === projectId)
      .sort((a, b) => b.workDate.localeCompare(a.workDate) || b.createdAt.localeCompare(a.createdAt));

    return {
      ...row,
      project,
      assignments,
      timeEntries,
      hoursByEmployee: groupValues(timeEntries, (entry) => entry.employeeName, (entry) => entry.hours),
      hoursByWeek: groupValues(timeEntries, (entry) => toWeekLabel(entry.workDate), (entry) => entry.hours).sort((a, b) => a.label.localeCompare(b.label)),
      hoursByCategory: groupValues(timeEntries, (entry) => entry.workCategory, (entry) => entry.hours)
    };
  }

  async exportTimeEntries() {
    const entries = await this.timeEntryRepository.getAll();
    return timeEntriesToCsv(entries);
  }

  async exportProjectProfitability() {
    const rows = await this.getProjectRows({});
    return projectFinancialsToCsv(
      rows.map((row) => ({
        id: row.projectId,
        projectName: row.projectName,
        projectEstimatedHrs: row.plannedLoeHours,
        projectStatus: row.projectStatus,
        projectCurrency: "",
        projectManager: row.projectManager,
        projectManagerEmail: "",
        projectStartDate: row.projectStartDate,
        projectEndDate: row.projectEndDate,
        projectDescription: "",
        budgetHours: row.plannedLoeHours,
        budgetCost: row.soldAmount,
        expenseBudgetProjectCurrency: row.actualCost,
        projectRegion: "",
        poNumber: "",
        projectSoldBy: "",
        numberOfResources: row.assignedEmployeeCount,
        numberOfWorkWeeks: null,
        plannedLoeHours: row.plannedLoeHours,
        soldAmount: row.soldAmount,
        blendedBillRate: null,
        blendedCostRate: null,
        profitabilityNotes: "",
        createdAt: "",
        updatedAt: ""
      }))
    );
  }

  private async getReferenceData() {
    const [projects, clients, assignments, entries] = await Promise.all([
      this.projectRepository.getAll(),
      this.clientRepository.getAll(),
      this.assignmentRepository.getAll(),
      this.timeEntryRepository.getAll()
    ]);

    return { projects, clients, assignments, entries };
  }

  private buildProjectRow(
    project: Project,
    clients: Client[],
    assignments: ProjectAssignment[],
    entries: TimeEntry[]
  ): TimeTrackingProjectRow {
    const projectAssignments = assignments.filter((assignment) => assignment.projectId === project.id);
    const activeAssignments = projectAssignments.filter((assignment) => assignment.active);
    const projectEntries = entries.filter((entry) => entry.projectId === project.id);
    const client = findLikelyClientForProject(project, clients);
    const plannedLoeHours = project.plannedLoeHours ?? project.budgetHours;
    const actualLoeHours = round(projectEntries.reduce((sum, entry) => sum + entry.hours, 0)) ?? 0;
    const remainingLoeHours = plannedLoeHours == null ? null : round(plannedLoeHours - actualLoeHours);
    const loeVarianceHours = plannedLoeHours == null ? null : round(actualLoeHours - plannedLoeHours);
    const loeUsedPercent =
      plannedLoeHours && plannedLoeHours > 0 ? round((actualLoeHours / plannedLoeHours) * 100) : null;
    const soldAmount = project.soldAmount ?? project.budgetCost;

    const plannedCostFromAssignments = activeAssignments
      .filter((assignment) => assignment.plannedHours != null && assignment.costRate != null)
      .reduce((sum, assignment) => sum + asNumber(assignment.plannedHours) * asNumber(assignment.costRate), 0);
    const plannedCost =
      plannedCostFromAssignments > 0
        ? round(plannedCostFromAssignments)
        : plannedLoeHours != null && project.blendedCostRate != null
          ? round(plannedLoeHours * project.blendedCostRate)
          : null;

    const actualCost = round(
      projectEntries.reduce((sum, entry) => {
        const assignment = activeAssignments.find((candidate) => candidate.employeeId === entry.employeeId);
        const rate = assignment?.costRate ?? project.blendedCostRate;
        return sum + entry.hours * asNumber(rate);
      }, 0)
    );
    const normalizedActualCost = actualCost && actualCost > 0 ? actualCost : projectEntries.length ? actualCost : null;
    const profit =
      soldAmount != null && normalizedActualCost != null ? round(soldAmount - normalizedActualCost) : null;
    const marginPercent = soldAmount && soldAmount > 0 && profit != null ? round((profit / soldAmount) * 100) : null;

    return {
      projectId: project.id,
      projectName: project.projectName,
      clientId: client?.id ?? null,
      clientName: client?.clientName ?? "",
      projectManager: project.projectManager,
      projectStatus: project.projectStatus,
      projectStartDate: project.projectStartDate,
      projectEndDate: project.projectEndDate,
      plannedLoeHours,
      actualLoeHours,
      remainingLoeHours,
      loeVarianceHours,
      loeUsedPercent,
      soldAmount,
      plannedCost,
      actualCost: normalizedActualCost,
      profit,
      marginPercent,
      profitabilityStatus: profitabilityStatus(marginPercent, loeUsedPercent),
      assignedEmployeeCount: activeAssignments.length,
      assignedEmployeesPreview: activeAssignments.slice(0, 4).map((assignment) => ({
        employeeId: assignment.employeeId,
        employeeName: assignment.employeeName
      }))
    };
  }

  private matchesFilters(row: TimeTrackingProjectRow, filters: TimeTrackingProjectFilters) {
    const haystack = normalizeValue(
      [
        row.projectName,
        row.clientName,
        row.projectManager,
        row.projectStatus,
        row.profitabilityStatus
      ].join(" ")
    ).toLowerCase();

    if (filters.search && !haystack.includes(normalizeValue(filters.search).toLowerCase())) {
      return false;
    }
    if (filters.clientId && row.clientId !== filters.clientId) {
      return false;
    }
    if (filters.projectManager && row.projectManager !== filters.projectManager) {
      return false;
    }
    if (filters.status && row.projectStatus !== filters.status) {
      return false;
    }
    if (filters.profitabilityStatus && row.profitabilityStatus !== filters.profitabilityStatus) {
      return false;
    }
    if (filters.startDate && (!row.projectStartDate || row.projectStartDate < filters.startDate)) {
      return false;
    }
    if (filters.endDate && (!row.projectEndDate || row.projectEndDate > filters.endDate)) {
      return false;
    }
    return true;
  }
}
