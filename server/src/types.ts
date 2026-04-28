export type SortField =
  | "name"
  | "hireDate"
  | "region"
  | "title"
  | "tenure";

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

export interface EmployeeInput {
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
}

export interface EmployeeFilters {
  search?: string;
  region?: string;
  country?: string;
  title?: string;
  supervisor?: string;
  titleCode?: string;
  hireYear?: string;
  page?: number;
  pageSize?: number;
  sortBy?: SortField;
  sortDirection?: "asc" | "desc";
}

export interface PaginatedEmployees {
  data: Employee[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

export interface ClientInput {
  clientName: string;
  clientStatus: string;
  clientInvoiceCurrency: string;
  clientContact: string;
  clientDescription: string;
  clientManager: string;
}

export interface ClientFilters {
  search?: string;
  clientStatus?: string;
  clientInvoiceCurrency?: string;
  clientManager?: string;
  missingContact?: boolean;
  missingDescription?: boolean;
  missingManager?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PaginatedClients {
  data: Client[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

export interface ProjectInput {
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
}

export interface ProjectFilters {
  search?: string;
  manager?: string;
  managerEmail?: string;
  poNumber?: string;
  soldBy?: string;
  projectStatus?: string;
  projectRegion?: string;
  projectCurrency?: string;
  missingPoNumber?: boolean;
  missingManager?: boolean;
  missingManagerEmail?: boolean;
  missingStartDate?: boolean;
  missingEndDate?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PaginatedProjects {
  data: Project[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ImportRowResult {
  rowNumber: number;
  status: "imported" | "updated" | "skipped";
  key?: string;
  reason?: string;
}

export interface ImportSummary {
  totalRows: number;
  importedRows: number;
  updatedRows: number;
  skippedRows: number;
  duplicateRows: string[];
  errors: string[];
  missingRequiredFields: Array<{
    rowNumber: number;
    fields: string[];
  }>;
  results: ImportRowResult[];
}

export interface BulkUpdatePayload {
  ids: string[];
  updates: Partial<
    Pick<EmployeeInput, "employeeRegion" | "supervisorName" | "country" | "title">
  >;
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

export interface ClientSummary {
  totalClients: number;
  activeClients: number;
  inactiveOrOtherClients: number;
  clientsMissingContact: number;
  clientsMissingDescription: number;
  clientsMissingManager: number;
}

export interface ProjectSummary {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  projectsMissingManager: number;
  projectsMissingManagerEmail: number;
  projectsMissingPoNumber: number;
  totalEstimatedHours: number;
  totalBudgetHours: number;
  totalBudgetCost: number;
  totalExpenseBudget: number;
  averageNumberOfResources: number;
  averageNumberOfWorkWeeks: number;
}
