export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  title: string;
  employeeRegion: string;
  supervisorName: string;
  employeeCell: string;
  country: string;
  titleCode: string;
  hireDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  clientName: string;
  clientStatus: string;
  clientInvoiceCurrency: string;
  clientContact: string;
  clientDescription: string;
  clientManager: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  projectName: string;
  projectEstimatedHrs: number | null;
  projectStatus: string;
  projectCurrency: string;
  projectManager: string;
  projectManagerEmail: string;
  projectStartDate: string | null;
  projectEndDate: string | null;
  projectDescription: string;
  budgetHours: number | null;
  budgetCost: number | null;
  expenseBudgetProjectCurrency: number | null;
  projectRegion: string;
  poNumber: string;
  projectSoldBy: string;
  numberOfResources: number | null;
  numberOfWorkWeeks: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  clientId: string | null;
  clientName: string;
  projectId: string;
  projectName: string;
  projectStatus: string;
  projectManager: string;
  workDate: string;
  hours: number;
  workCategory: string;
  billable: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntryEmployeeOption {
  id: string;
  fullName: string;
  email: string;
  title: string;
  employeeRegion: string;
  supervisorName: string;
}

export interface TimeEntryProjectOption {
  id: string;
  projectName: string;
  clientId: string | null;
  clientName: string;
  projectStatus: string;
  projectManager: string;
  projectStartDate: string | null;
  projectEndDate: string | null;
  projectRegion: string;
  budgetHours: number | null;
  budgetCost: number | null;
  label: string;
}

export interface TimeEntrySummary {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  entryCount: number;
  uniqueEmployees: number;
  uniqueProjects: number;
  hoursByProject: Array<{ label: string; value: number; projectId?: string | null }>;
  hoursByEmployee: Array<{ label: string; value: number; employeeId?: string | null }>;
  hoursByClient: Array<{ label: string; value: number; clientId?: string | null }>;
  hoursByWeek: Array<{ label: string; value: number }>;
  billableByWeek: Array<{ label: string; billableHours: number; nonBillableHours: number }>;
  utilizationHints: Array<{
    projectId: string;
    projectName: string;
    budgetHours: number | null;
    actualHours: number;
    remainingHours: number | null;
    percentUsed: number | null;
    status: "healthy" | "watch" | "at-risk" | "unbudgeted";
  }>;
}

export interface EmployeeListResponse {
  data: Employee[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ClientListResponse {
  data: Client[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProjectListResponse {
  data: Project[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TimeEntryListResponse {
  data: TimeEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface EmployeeDetailResponse {
  employee: Employee;
  supervisor?: Employee | null;
  directReports: Employee[];
  relatedEmployees: Employee[];
}

export interface ClientDetailResponse {
  client: Client;
  relatedProjects: Project[];
}

export interface ProjectDetailResponse {
  project: Project;
}

export interface TimeEntryDetailResponse {
  timeEntry: TimeEntry;
}

export interface ImportSummary {
  totalRows: number;
  importedRows: number;
  updatedRows: number;
  skippedRows: number;
  duplicateRows: string[];
  errors: string[];
  missingRequiredFields: Array<{ rowNumber: number; fields: string[] }>;
  results: Array<{
    rowNumber: number;
    status: "imported" | "updated" | "skipped";
    key?: string;
    reason?: string;
  }>;
}

export interface DataQualityIssue {
  type: string;
  severity: "warning" | "error" | "info";
  entityType: "employee" | "client" | "project";
  entityId?: string;
  entityName?: string;
  email?: string;
  message: string;
}

export interface DataQualitySummary {
  employees: DataQualityIssue[];
  clients: DataQualityIssue[];
  projects: DataQualityIssue[];
}

export interface DashboardSummary {
  totalEmployees: number;
  totalClients: number;
  totalProjects: number;
  activeProjects: number;
  projectsMissingPoNumber: number;
  clientsMissingManager: number;
  employeesByRegion: Array<{ label: string; value: number }>;
  employeesByCountry: Array<{ label: string; value: number }>;
  employeesByTitle: Array<{ label: string; value: number }>;
  employeesByTitleCode: Array<{ label: string; value: number }>;
  newestHires: Employee[];
  longestTenuredEmployees: Employee[];
  largestSupervisorTeams: Array<{ supervisorName: string; teamSize: number }>;
  missingDataWarnings: DataQualityIssue[];
}

export interface OrgGroup {
  supervisorName: string;
  teamSize: number;
  region: string;
  country: string;
  supervisorExists: boolean;
  reports: Employee[];
}

export interface EmployeeFilters {
  search: string;
  region: string;
  country: string;
  title: string;
  supervisor: string;
  titleCode: string;
  hireYear: string;
  page: number;
  pageSize: number;
  sortBy: "name" | "hireDate" | "region" | "title" | "tenure";
  sortDirection: "asc" | "desc";
}

export interface ClientFilters {
  search: string;
  clientStatus: string;
  clientInvoiceCurrency: string;
  clientManager: string;
  missingContact: boolean;
  missingDescription: boolean;
  missingManager: boolean;
  page: number;
  pageSize: number;
}

export interface ProjectFilters {
  search: string;
  manager: string;
  managerEmail: string;
  poNumber: string;
  soldBy: string;
  projectStatus: string;
  projectRegion: string;
  projectCurrency: string;
  missingPoNumber: boolean;
  missingManager: boolean;
  missingManagerEmail: boolean;
  missingStartDate: boolean;
  missingEndDate: boolean;
  page: number;
  pageSize: number;
}

export interface TimeEntryFilters {
  employeeId?: string;
  clientId?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  billable?: boolean;
  workCategory?: string;
  search?: string;
  page: number;
  pageSize: number;
  sortBy: "workDate" | "hours" | "employeeName" | "projectName" | "createdAt";
  sortDirection: "asc" | "desc";
}
