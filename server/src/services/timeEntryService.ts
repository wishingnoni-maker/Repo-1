import type {
  Client,
  PaginatedTimeEntries,
  Project,
  TimeEntry,
  TimeEntryEmployeeOption,
  TimeEntryFilters,
  TimeEntryInput,
  TimeEntryProjectOption,
  TimeEntrySummary,
  TimeEntryUtilizationHint
} from "../types.js";
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
import { timeEntriesToCsv } from "./exportService.js";
import {
  findLikelyClientForProject,
  isEligibleTimeTrackingProject,
  matchesTimeEntryFilters,
  sortTimeEntries
} from "../utils/timeEntry.js";

const roundHours = (value: number) => Math.round(value * 100) / 100;

const startOfWeekLabel = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  const utcDay = parsed.getUTCDay();
  const offset = utcDay === 0 ? 6 : utcDay - 1;
  parsed.setUTCDate(parsed.getUTCDate() - offset);
  return parsed.toISOString().slice(0, 10);
};

const groupSum = <T>(
  items: T[],
  keyOf: (item: T) => string,
  valueOf: (item: T) => number
) =>
  Array.from(
    items.reduce((map, item) => {
      const key = keyOf(item) || "Unassigned";
      map.set(key, roundHours((map.get(key) ?? 0) + valueOf(item)));
      return map;
    }, new Map<string, number>())
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

export class TimeEntryService {
  constructor(
    private readonly repository: TimeEntryRepository = createTimeEntryRepository(),
    private readonly employeeRepository: EmployeeRepository = createEmployeeRepository(),
    private readonly clientRepository: ClientRepository = createClientRepository(),
    private readonly projectRepository: ProjectRepository = createProjectRepository()
  ) {}

  async getAll(): Promise<TimeEntry[]> {
    const [entries, refs] = await Promise.all([this.repository.getAll(), this.getReferenceData()]);
    return this.enrichEntries(entries, refs.employees, refs.clients, refs.projects);
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
    const raw = await this.repository.getById(id);
    if (!raw) {
      return null;
    }
    const refs = await this.getReferenceData();
    return this.enrichEntries([raw], refs.employees, refs.clients, refs.projects)[0] ?? null;
  }

  private async getReferenceData() {
    const [employees, clients, projects] = await Promise.all([
      this.employeeRepository.getAll(),
      this.clientRepository.getAll(),
      this.projectRepository.getAll()
    ]);

    return { employees, clients, projects };
  }

  private resolveClientId(input: Partial<TimeEntryInput>, projects: Project[], clients: Client[]) {
    if (input.clientId !== undefined) {
      return input.clientId;
    }
    const project = projects.find((candidate) => candidate.id === input.projectId);
    if (!project) {
      return null;
    }
    return findLikelyClientForProject(project, clients)?.id ?? null;
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

  async create(input: TimeEntryInput): Promise<TimeEntry> {
    const { employees, clients, projects } = await this.getReferenceData();

    if (!employees.some((employee) => employee.id === input.employeeId)) {
      throw new Error("Selected employee was not found.");
    }
    if (!projects.some((project) => project.id === input.projectId)) {
      throw new Error("Selected project was not found.");
    }
    if (input.clientId && !clients.some((client) => client.id === input.clientId)) {
      throw new Error("Selected client was not found.");
    }

    const resolved = {
      ...input,
      clientId: this.resolveClientId(input, projects, clients)
    };

    const created = await this.repository.create(resolved);
    return this.enrichEntries([created], employees, clients, projects)[0];
  }

  async update(id: string, input: Partial<TimeEntryInput>): Promise<TimeEntry | null> {
    const existing = await this.repository.getById(id);
    if (!existing) {
      return null;
    }

    const { employees, clients, projects } = await this.getReferenceData();

    if (input.employeeId && !employees.some((employee) => employee.id === input.employeeId)) {
      throw new Error("Selected employee was not found.");
    }
    if (input.projectId && !projects.some((project) => project.id === input.projectId)) {
      throw new Error("Selected project was not found.");
    }
    if (input.clientId && !clients.some((client) => client.id === input.clientId)) {
      throw new Error("Selected client was not found.");
    }

    const resolved = {
      ...input,
      clientId:
        input.clientId === undefined
          ? this.resolveClientId(
              { ...existing, projectId: input.projectId ?? existing.projectId } as Partial<TimeEntryInput>,
              projects,
              clients
            )
          : input.clientId
    };

    const updated = await this.repository.update(id, resolved);
    return updated ? this.enrichEntries([updated], employees, clients, projects)[0] : null;
  }

  async delete(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

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

  async getEligibleProjectOptions(): Promise<TimeEntryProjectOption[]> {
    const [projects, clients] = await Promise.all([
      this.projectRepository.getAll(),
      this.clientRepository.getAll()
    ]);

    return projects
      .filter((project) => isEligibleTimeTrackingProject(project))
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
          label: [
            project.projectName,
            client?.clientName,
            project.projectManager,
            project.projectStatus
          ]
            .filter(Boolean)
            .join(" — ")
        };
      })
      .sort((a, b) => a.projectName.localeCompare(b.projectName));
  }

  async getSummary(filters: TimeEntryFilters): Promise<TimeEntrySummary> {
    const [entries, projects] = await Promise.all([this.repository.getAll(), this.projectRepository.getAll()]);
    const filtered = sortTimeEntries(
      entries.filter((entry) => matchesTimeEntryFilters(entry, filters)),
      filters.sortBy,
      filters.sortDirection
    );

    const totalHours = roundHours(filtered.reduce((sum, entry) => sum + entry.hours, 0));
    const billableHours = roundHours(filtered.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.hours, 0));
    const nonBillableHours = roundHours(totalHours - billableHours);
    const uniqueEmployees = new Set(filtered.map((entry) => entry.employeeId)).size;
    const uniqueProjects = new Set(filtered.map((entry) => entry.projectId)).size;

    const hoursByWeek = groupSum(filtered, (entry) => startOfWeekLabel(entry.workDate), (entry) => entry.hours);
    const billableByWeek = Array.from(
      filtered.reduce((map, entry) => {
        const key = startOfWeekLabel(entry.workDate);
        const current = map.get(key) ?? { label: key, billableHours: 0, nonBillableHours: 0 };
        if (entry.billable) {
          current.billableHours = roundHours(current.billableHours + entry.hours);
        } else {
          current.nonBillableHours = roundHours(current.nonBillableHours + entry.hours);
        }
        map.set(key, current);
        return map;
      }, new Map<string, { label: string; billableHours: number; nonBillableHours: number }>())
    )
      .map(([, value]) => value)
      .sort((a, b) => a.label.localeCompare(b.label));

    const actualByProject = filtered.reduce((map, entry) => {
      map.set(entry.projectId, roundHours((map.get(entry.projectId) ?? 0) + entry.hours));
      return map;
    }, new Map<string, number>());

    const utilizationHints: TimeEntryUtilizationHint[] = projects
      .filter((project) => actualByProject.has(project.id))
      .map((project) => {
        const actualHours = actualByProject.get(project.id) ?? 0;
        const budgetHours = project.budgetHours;
        const remainingHours = budgetHours == null ? null : roundHours(budgetHours - actualHours);
        const percentUsed = budgetHours && budgetHours > 0 ? roundHours((actualHours / budgetHours) * 100) : null;
        const status: TimeEntryUtilizationHint["status"] =
          budgetHours == null
            ? "unbudgeted"
            : percentUsed != null && percentUsed >= 100
              ? "at-risk"
              : percentUsed != null && percentUsed >= 80
                ? "watch"
                : "healthy";

        return {
          projectId: project.id,
          projectName: project.projectName,
          budgetHours,
          actualHours,
          remainingHours,
          percentUsed,
          status
        };
      })
      .sort((a, b) => b.actualHours - a.actualHours)
      .slice(0, 10);

    return {
      totalHours,
      billableHours,
      nonBillableHours,
      entryCount: filtered.length,
      uniqueEmployees,
      uniqueProjects,
      hoursByProject: groupSum(filtered, (entry) => entry.projectName, (entry) => entry.hours).map((item) => ({
        ...item,
        projectId: filtered.find((entry) => entry.projectName === item.label)?.projectId ?? null
      })),
      hoursByEmployee: groupSum(filtered, (entry) => entry.employeeName, (entry) => entry.hours).map((item) => ({
        ...item,
        employeeId: filtered.find((entry) => entry.employeeName === item.label)?.employeeId ?? null
      })),
      hoursByClient: groupSum(filtered, (entry) => entry.clientName || "Unassigned", (entry) => entry.hours).map((item) => ({
        ...item,
        clientId: filtered.find((entry) => (entry.clientName || "Unassigned") === item.label)?.clientId ?? null
      })),
      hoursByWeek,
      billableByWeek,
      utilizationHints
    };
  }

  async exportCsv(filters: TimeEntryFilters) {
    const entries = await this.getAll();
    const filtered = sortTimeEntries(
      entries.filter((entry) => matchesTimeEntryFilters(entry, filters)),
      filters.sortBy,
      filters.sortDirection
    );
    return timeEntriesToCsv(filtered);
  }
}
