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

export interface ImportRowResult {
  rowNumber: number;
  status: "imported" | "updated" | "skipped";
  email?: string;
  reason?: string;
}

export interface ImportSummary {
  totalRows: number;
  successfullyImported: number;
  updatedRecords: number;
  skippedRows: number;
  duplicateEmails: string[];
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
  type:
    | "missing_email"
    | "duplicate_email"
    | "missing_title"
    | "missing_supervisor"
    | "invalid_hire_date"
    | "missing_region_or_country"
    | "phone_format"
    | "title_code_without_title"
    | "supervisor_not_found";
  severity: "warning" | "error";
  employeeId?: string;
  employeeName?: string;
  email?: string;
  message: string;
}

export interface DashboardSummary {
  totalEmployees: number;
  employeesByRegion: Array<{ label: string; value: number }>;
  employeesByCountry: Array<{ label: string; value: number }>;
  employeesByTitle: Array<{ label: string; value: number }>;
  employeesByTitleCode: Array<{ label: string; value: number }>;
  newestHires: Employee[];
  longestTenuredEmployees: Employee[];
  largestSupervisorTeams: Array<{ supervisorName: string; teamSize: number }>;
  missingDataWarnings: DataQualityIssue[];
}
