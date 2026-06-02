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
  plannedLoeHours: number | null;
  soldAmount: number | null;
  blendedBillRate: number | null;
  blendedCostRate: number | null;
  profitabilityNotes: string;
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
  approvalStatus: "draft" | "submitted" | "approved" | "rejected";
  locked: boolean;
  source: string;
  notes: string;
  timesheetWeekStart: string | null;
  rowGroupId: string | null;
  holidayReason: string;
  createdAt: string;
  updatedAt: string;
}

export type TimesheetDayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface WeeklyTimesheetDay {
  key: TimesheetDayKey;
  date: string;
  label: string;
}

export interface WeeklyTimesheetRow {
  rowGroupId: string;
  clientId: string | null;
  clientName: string;
  projectId: string;
  projectName: string;
  workCategory: string;
  billable: boolean;
  notes: string;
  holidayOrWeekendReason: string;
  hours: Record<TimesheetDayKey, number>;
}

export interface WeeklyTimesheetTotals extends Record<TimesheetDayKey, number> {
  weeklyTotal: number;
  billableTotal: number;
  nonBillableTotal: number;
}

export interface WeeklyTimesheet {
  employeeId: string;
  employeeName: string;
  weekStart: string;
  weekEnd: string;
  status: "not-started" | "draft" | "submitted" | "approved" | "rejected";
  showWeekend: boolean;
  days: WeeklyTimesheetDay[];
  rows: WeeklyTimesheetRow[];
  totals: WeeklyTimesheetTotals;
}

export interface SaveWeeklyTimesheetRowInput {
  rowGroupId?: string | null;
  clientId?: string | null;
  projectId: string;
  workCategory: string;
  billable: boolean;
  notes: string;
  holidayOrWeekendReason: string;
  hours: Partial<Record<TimesheetDayKey, number>>;
}

export interface SaveWeeklyTimesheetInput {
  employeeId: string;
  weekStart: string;
  status: "draft" | "submitted";
  showWeekend: boolean;
  rows: SaveWeeklyTimesheetRowInput[];
}

export interface TimesheetEmployeeOption {
  id: string;
  fullName: string;
  email: string;
  title: string;
  employeeRegion: string;
  supervisorName: string;
}

export interface TimesheetClientOption {
  id: string;
  clientName: string;
  clientManager: string;
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
  plannedLoeHours?: number | null;
  actualLoeHours?: number;
  remainingLoeHours?: number | null;
  loeUsedPercent?: number | null;
  soldAmount?: number | null;
  actualCost?: number | null;
  marginPercent?: number | null;
  profitabilityStatus?: "Great" | "Healthy" | "At Risk" | "Unprofitable" | "Unknown";
  assignedEmployeeCount?: number;
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

export interface ProjectAssignment {
  id: string;
  projectId: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeTitle: string;
  employeeRegion: string;
  roleOnProject: string;
  plannedHours: number | null;
  billRate: number | null;
  costRate: number | null;
  allocationPercent: number | null;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeTrackingDashboard {
  totalHoursThisWeek: number;
  totalHoursThisMonth: number;
  billableHoursThisMonth: number;
  nonBillableHoursThisMonth: number;
  activeProjectsWithTime: number;
  projectsAtRisk: number;
  totalSoldAmount: number | null;
  estimatedActualCost: number | null;
  estimatedProfit: number | null;
  averageMarginPercent: number | null;
  topProjectsByHours: Array<{ label: string; value: number; projectId: string | null }>;
  topEmployeesByHours: Array<{ label: string; value: number; employeeId: string | null }>;
  recentEntries: TimeEntry[];
}

export interface TimeTrackingProjectRow {
  projectId: string;
  projectName: string;
  clientId: string | null;
  clientName: string;
  projectManager: string;
  projectStatus: string;
  projectStartDate: string | null;
  projectEndDate: string | null;
  plannedLoeHours: number | null;
  actualLoeHours: number;
  remainingLoeHours: number | null;
  loeVarianceHours: number | null;
  loeUsedPercent: number | null;
  soldAmount: number | null;
  plannedCost: number | null;
  actualCost: number | null;
  profit: number | null;
  marginPercent: number | null;
  profitabilityStatus: "Great" | "Healthy" | "At Risk" | "Unprofitable" | "Unknown";
  assignedEmployeeCount: number;
  assignedEmployeesPreview: Array<{ employeeId: string; employeeName: string }>;
}

export interface TimeTrackingProjectDetail extends TimeTrackingProjectRow {
  project: Project;
  assignments: ProjectAssignment[];
  timeEntries: TimeEntry[];
  hoursByEmployee: Array<{ label: string; value: number; employeeId?: string | null }>;
  hoursByWeek: Array<{ label: string; value: number }>;
  hoursByCategory: Array<{ label: string; value: number }>;
}

export interface TimeTrackingProjectFilters {
  clientId?: string;
  projectManager?: string;
  status?: string;
  profitabilityStatus?: string;
  startDate?: string;
  endDate?: string;
  lastFiveYearsOnly?: boolean;
  search?: string;
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

export interface SystemStatusResponse {
  ok: boolean;
  dataProvider: "json" | "postgres" | "sql";
  hasDatabaseUrl: boolean;
  databaseSsl: boolean;
  postgresConnected: boolean | null;
  postgresError: string | null;
  counts: {
    employees: number | null;
    clients: number | null;
    projects: number | null;
  };
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
  approvalStatus?: string;
  search?: string;
  page: number;
  pageSize: number;
  sortBy: "workDate" | "hours" | "employeeName" | "projectName" | "createdAt";
  sortDirection: "asc" | "desc";
}
