import type {
  Client,
  ClientDetailResponse,
  ClientFilters,
  ClientListResponse,
  DashboardSummary,
  DataQualitySummary,
  Employee,
  EmployeeDetailResponse,
  EmployeeFilters,
  EmployeeListResponse,
  ImportSummary,
  OrgGroup,
  Project,
  ProjectDetailResponse,
  ProjectFilters,
  ProjectListResponse,
  TimeEntry,
  TimeEntryDetailResponse,
  TimeEntryEmployeeOption,
  TimeEntryFilters,
  TimeEntryListResponse,
  TimeEntryProjectOption,
  TimeEntrySummary,
  TimesheetClientOption,
  TimesheetEmployeeOption,
  WeeklyTimesheet,
  SaveWeeklyTimesheetInput,
  ProjectAssignment,
  TimeTrackingDashboard,
  TimeTrackingProjectDetail,
  TimeTrackingProjectFilters,
  TimeTrackingProjectRow
} from "../types";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  "http://localhost:4000/api";

const buildQuery = (params: object) => {
  const searchParams = new URLSearchParams();
  Object.entries(params as Record<string, string | number | boolean | undefined>).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  return searchParams.toString();
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new Error("API request failed. Check VITE_API_BASE_URL or backend availability.");
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed." }));
    throw new Error(error.message ?? "Request failed.");
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

const uploadImport = (path: string, file: File, replaceExisting: boolean) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("replaceExisting", String(replaceExisting));
  return request<ImportSummary>(path, {
    method: "POST",
    body: formData
  });
};

export const api = {
  getEmployees: (filters: EmployeeFilters) =>
    request<EmployeeListResponse>(`/employees?${buildQuery(filters)}`),
  getEmployee: (id: string) => request<EmployeeDetailResponse>(`/employees/${id}`),
  createEmployee: (payload: Partial<Employee>) =>
    request<Employee>("/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  updateEmployee: (id: string, payload: Partial<Employee>) =>
    request<Employee>(`/employees/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  deleteEmployee: (id: string) =>
    request<void>(`/employees/${id}`, { method: "DELETE" }),
  bulkDelete: (ids: string[]) =>
    request<{ deletedCount: number }>("/employees/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    }),
  bulkUpdate: (
    ids: string[],
    updates: Partial<Pick<Employee, "employeeRegion" | "supervisorName" | "country" | "title">>
  ) =>
    request<{ updatedCount: number }>("/employees/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, updates })
    }),
  importEmployees: (file: File) => uploadImport("/import/employees", file, false),

  getClients: (filters: ClientFilters) =>
    request<ClientListResponse>(`/clients?${buildQuery(filters)}`),
  getClient: (id: string) => request<ClientDetailResponse>(`/clients/${id}`),
  createClient: (payload: Partial<Client>) =>
    request<Client>("/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  updateClient: (id: string, payload: Partial<Client>) =>
    request<Client>(`/clients/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  deleteClient: (id: string) =>
    request<void>(`/clients/${id}`, { method: "DELETE" }),
  importClients: (file: File, replaceExisting: boolean) =>
    uploadImport("/import/clients", file, replaceExisting),
  getClientQuality: () => request<import("../types").DataQualityIssue[]>(`/clients/quality/issues`),

  getProjects: (filters: ProjectFilters) =>
    request<ProjectListResponse>(`/projects?${buildQuery(filters)}`),
  getProject: (id: string) => request<ProjectDetailResponse>(`/projects/${id}`),
  createProject: (payload: Partial<Project>) =>
    request<Project>("/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  updateProject: (id: string, payload: Partial<Project>) =>
    request<Project>(`/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  deleteProject: (id: string) =>
    request<void>(`/projects/${id}`, { method: "DELETE" }),
  importProjects: (file: File, replaceExisting: boolean) =>
    uploadImport("/import/projects", file, replaceExisting),
  getProjectQuality: () => request<import("../types").DataQualityIssue[]>(`/projects/quality/issues`),

  getTimeEntries: (filters: TimeEntryFilters) =>
    request<TimeEntryListResponse>(`/time-entries?${buildQuery(filters)}`),
  getTimeEntry: (id: string) => request<TimeEntryDetailResponse>(`/time-entries/${id}`),
  createTimeEntry: (payload: Partial<TimeEntry>) =>
    request<TimeEntry>("/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  updateTimeEntry: (id: string, payload: Partial<TimeEntry>) =>
    request<TimeEntry>(`/time-entries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  deleteTimeEntry: (id: string) =>
    request<void>(`/time-entries/${id}`, { method: "DELETE" }),
  getTimeEntrySummary: (filters: Partial<TimeEntryFilters> = {}) =>
    request<TimeEntrySummary>(`/time-entries/summary?${buildQuery(filters)}`),
  getTimeEntryProjectOptions: () => request<TimeEntryProjectOption[]>("/time-entries/project-options"),
  getTimeEntryEmployeeOptions: () => request<TimeEntryEmployeeOption[]>("/time-entries/employee-options"),

  getTimeTrackingDashboard: () => request<TimeTrackingDashboard>("/time-tracking/dashboard"),
  getTimeTrackingProjects: (filters: TimeTrackingProjectFilters = {}) =>
    request<TimeTrackingProjectRow[]>(`/time-tracking/projects?${buildQuery(filters)}`),
  getTimeTrackingProject: (projectId: string) =>
    request<TimeTrackingProjectDetail>(`/time-tracking/projects/${projectId}`),
  getTimeTrackingProjectOptions: () => request<TimeEntryProjectOption[]>("/time-tracking/project-options"),
  getTimeTrackingEmployeeOptions: () => request<TimeEntryEmployeeOption[]>("/time-tracking/employee-options"),
  getTimesheetWeek: (employeeId: string, weekStart: string) =>
    request<WeeklyTimesheet>(`/timesheets/week?${buildQuery({ employeeId, weekStart })}`),
  saveTimesheetWeek: (payload: SaveWeeklyTimesheetInput) =>
    request<WeeklyTimesheet>("/timesheets/week/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  submitTimesheetWeek: (employeeId: string, weekStart: string) =>
    request<WeeklyTimesheet>("/timesheets/week/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, weekStart })
    }),
  copyPreviousTimesheetWeek: (employeeId: string, targetWeekStart: string) =>
    request<WeeklyTimesheet>("/timesheets/week/copy-previous", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, targetWeekStart })
    }),
  getTimesheets: (params: {
    employeeId?: string;
    clientId?: string;
    projectId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    billable?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => request<TimeEntryListResponse>(`/timesheets?${buildQuery(params)}`),
  getTimesheetEmployeeOptions: () => request<TimesheetEmployeeOption[]>("/timesheets/options/employees"),
  getTimesheetClientOptions: () => request<TimesheetClientOption[]>("/timesheets/options/clients"),
  getTimesheetProjectOptions: (params?: { clientId?: string; search?: string; recentOnly?: boolean }) =>
    request<TimeEntryProjectOption[]>(`/timesheets/options/projects?${buildQuery(params ?? {})}`),
  getProjectAssignments: (projectId?: string) =>
    request<ProjectAssignment[]>(`/project-assignments${projectId ? `?${buildQuery({ projectId })}` : ""}`),
  createProjectAssignment: (payload: Partial<ProjectAssignment>) =>
    request<ProjectAssignment>("/project-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  createProjectAssignmentsBulk: (payload: {
    projectId: string;
    employeeIds: string[];
    roleOnProject: string;
    plannedHours: number | null;
    billRate: number | null;
    costRate: number | null;
    allocationPercent: number | null;
    startDate: string | null;
    endDate: string | null;
    active: boolean;
  }) =>
    request<ProjectAssignment[]>("/project-assignments/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  updateProjectAssignment: (id: string, payload: Partial<ProjectAssignment>) =>
    request<ProjectAssignment>(`/project-assignments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  deleteProjectAssignment: (id: string) =>
    request<void>(`/project-assignments/${id}`, { method: "DELETE" }),

  getDashboard: () => request<DashboardSummary>("/dashboard/summary"),
  getDataQuality: () => request<DataQualitySummary>("/data-quality"),
  getOrgGroups: (region?: string, country?: string) =>
    request<OrgGroup[]>(`/org/supervisors?${buildQuery({ region, country })}`),
  exportUrl: (path: string, params?: Record<string, string | number | boolean | undefined>) =>
    `${API_BASE}${path}${params ? `?${buildQuery(params)}` : ""}`
};
