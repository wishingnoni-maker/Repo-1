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

export interface EmployeeListResponse {
  data: Employee[];
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

export interface ImportSummary {
  totalRows: number;
  successfullyImported: number;
  updatedRecords: number;
  skippedRows: number;
  duplicateEmails: string[];
  missingRequiredFields: Array<{ rowNumber: number; fields: string[] }>;
  results: Array<{
    rowNumber: number;
    status: "imported" | "updated" | "skipped";
    email?: string;
    reason?: string;
  }>;
}

export interface DataQualityIssue {
  type: string;
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

export interface OrgGroup {
  supervisorName: string;
  teamSize: number;
  region: string;
  country: string;
  supervisorExists: boolean;
  reports: Employee[];
}

export interface Filters {
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
