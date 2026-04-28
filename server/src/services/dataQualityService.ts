import type { Client, DataQualityIssue, Employee, Project } from "../types.js";
import { normalizeSupervisorKey } from "../utils/employee.js";
import { slugifyName } from "../utils/text.js";

const phonePattern = /^[+\d()\-\s.]{7,20}$/;

const pushIssue = (
  issues: DataQualityIssue[],
  issue: Omit<DataQualityIssue, "severity"> & { severity?: "warning" | "error" }
) => {
  issues.push({
    severity: issue.severity ?? "warning",
    ...issue
  });
};

export const buildEmployeeDataQualityIssues = (employees: Employee[]): DataQualityIssue[] => {
  const issues: DataQualityIssue[] = [];
  const emailCounts = employees.reduce((map, employee) => {
    const key = employee.email.toLowerCase();
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  const employeeNameKeys = new Set(employees.map((employee) => normalizeSupervisorKey(employee.fullName)));

  employees.forEach((employee) => {
    if (!employee.email) {
      pushIssue(issues, {
        type: "missing_email",
        severity: "error",
        entityType: "employee",
        entityId: employee.id,
        entityName: employee.fullName,
        message: "Employee is missing an email address."
      });
    }
    if (employee.email && (emailCounts.get(employee.email.toLowerCase()) ?? 0) > 1) {
      pushIssue(issues, {
        type: "duplicate_email",
        severity: "error",
        entityType: "employee",
        entityId: employee.id,
        entityName: employee.fullName,
        email: employee.email,
        message: "Employee email appears more than once."
      });
    }
    if (!employee.title) {
      pushIssue(issues, {
        type: "missing_title",
        entityType: "employee",
        entityId: employee.id,
        entityName: employee.fullName,
        message: "Employee is missing a title."
      });
    }
    if (!employee.supervisorName) {
      pushIssue(issues, {
        type: "missing_supervisor",
        entityType: "employee",
        entityId: employee.id,
        entityName: employee.fullName,
        message: "Employee does not have a supervisor listed."
      });
    }
    if (employee.hireDate === null) {
      pushIssue(issues, {
        type: "invalid_hire_date",
        entityType: "employee",
        entityId: employee.id,
        entityName: employee.fullName,
        message: "Hire date is missing or invalid."
      });
    }
    if (!employee.country || !employee.employeeRegion) {
      pushIssue(issues, {
        type: "missing_region_or_country",
        entityType: "employee",
        entityId: employee.id,
        entityName: employee.fullName,
        message: "Employee is missing region or country."
      });
    }
    if (employee.employeeCell && !phonePattern.test(employee.employeeCell)) {
      pushIssue(issues, {
        type: "phone_format",
        entityType: "employee",
        entityId: employee.id,
        entityName: employee.fullName,
        message: "Employee cell number format looks unusual."
      });
    }
    if (employee.titleCode && !employee.title) {
      pushIssue(issues, {
        type: "title_code_without_title",
        entityType: "employee",
        entityId: employee.id,
        entityName: employee.fullName,
        message: "Title code exists without a matching title."
      });
    }
    if (employee.supervisorName && !employeeNameKeys.has(normalizeSupervisorKey(employee.supervisorName))) {
      pushIssue(issues, {
        type: "supervisor_not_found",
        entityType: "employee",
        entityId: employee.id,
        entityName: employee.fullName,
        message: "Supervisor name does not match any employee in the directory."
      });
    }
  });

  return issues;
};

export const buildClientDataQualityIssues = (clients: Client[]): DataQualityIssue[] => {
  const issues: DataQualityIssue[] = [];
  const nameCounts = clients.reduce((map, client) => {
    const key = slugifyName(client.clientName);
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  clients.forEach((client) => {
    if (!client.clientName) {
      pushIssue(issues, {
        type: "missing_client_name",
        severity: "error",
        entityType: "client",
        entityId: client.id,
        entityName: client.clientName || "Unnamed client",
        message: "Client is missing a client name."
      });
    }
    if (client.clientName && (nameCounts.get(slugifyName(client.clientName)) ?? 0) > 1) {
      pushIssue(issues, {
        type: "duplicate_client_name",
        severity: "error",
        entityType: "client",
        entityId: client.id,
        entityName: client.clientName,
        message: "Client name appears more than once."
      });
    }
    if (!client.clientContact) {
      pushIssue(issues, {
        type: "missing_client_contact",
        entityType: "client",
        entityId: client.id,
        entityName: client.clientName,
        message: "Client contact is missing."
      });
    }
    if (!client.clientDescription) {
      pushIssue(issues, {
        type: "missing_client_description",
        entityType: "client",
        entityId: client.id,
        entityName: client.clientName,
        message: "Client description is missing."
      });
    }
    if (!client.clientManager) {
      pushIssue(issues, {
        type: "missing_client_manager",
        entityType: "client",
        entityId: client.id,
        entityName: client.clientName,
        message: "Client manager is missing."
      });
    }
    if (!client.clientInvoiceCurrency) {
      pushIssue(issues, {
        type: "missing_client_invoice_currency",
        entityType: "client",
        entityId: client.id,
        entityName: client.clientName,
        message: "Client invoice currency is missing."
      });
    }
  });

  return issues;
};

export const buildProjectDataQualityIssues = (projects: Project[]): DataQualityIssue[] => {
  const issues: DataQualityIssue[] = [];
  const nameCounts = projects.reduce((map, project) => {
    const key = slugifyName(project.projectName);
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  projects.forEach((project) => {
    const issueBase = {
      entityType: "project" as const,
      entityId: project.id,
      entityName: project.projectName || "Unnamed project"
    };

    if (!project.projectName) {
      pushIssue(issues, {
        ...issueBase,
        type: "missing_project_name",
        severity: "error",
        message: "Project is missing a project name."
      });
    }
    if (project.projectName && (nameCounts.get(slugifyName(project.projectName)) ?? 0) > 1) {
      pushIssue(issues, {
        ...issueBase,
        type: "duplicate_project_name",
        severity: "error",
        message: "Project name appears more than once."
      });
    }
    const missingStringFields: Array<[string, string, string]> = [
      ["missing_project_status", project.projectStatus, "Project status is missing."],
      ["missing_project_currency", project.projectCurrency, "Project currency is missing."],
      ["missing_project_manager", project.projectManager, "Project manager is missing."],
      ["missing_project_manager_email", project.projectManagerEmail, "Project manager email is missing."],
      ["missing_project_po_number", project.poNumber, "Project PO number is missing."],
      ["missing_project_region", project.projectRegion, "Project region is missing."],
      ["missing_project_sold_by", project.projectSoldBy, "Project sold-by person is missing."]
    ];
    missingStringFields.forEach(([type, value, message]) => {
      if (!value) {
        pushIssue(issues, { ...issueBase, type, message });
      }
    });

    if (!project.projectStartDate) {
      pushIssue(issues, { ...issueBase, type: "missing_project_start_date", message: "Project start date is missing." });
    }
    if (!project.projectEndDate) {
      pushIssue(issues, { ...issueBase, type: "missing_project_end_date", message: "Project end date is missing." });
    }
    if (project.budgetHours === null) {
      pushIssue(issues, { ...issueBase, type: "missing_budget_hours", message: "Budget hours are missing." });
    }
    if (project.budgetCost === null) {
      pushIssue(issues, { ...issueBase, type: "missing_budget_cost", message: "Budget cost is missing." });
    }
    if (project.expenseBudgetProjectCurrency === null) {
      pushIssue(issues, { ...issueBase, type: "missing_expense_budget", message: "Expense budget is missing." });
    }
    if (project.projectEstimatedHrs === null) {
      pushIssue(issues, { ...issueBase, type: "invalid_project_estimated_hrs", message: "Project estimated hours are missing or invalid." });
    }
    if (project.numberOfResources === null) {
      pushIssue(issues, { ...issueBase, type: "invalid_number_of_resources", message: "Number of resources is missing or invalid." });
    }
    if (project.numberOfWorkWeeks === null) {
      pushIssue(issues, { ...issueBase, type: "invalid_number_of_work_weeks", message: "Number of work weeks is missing or invalid." });
    }
  });

  return issues;
};

export const buildDataQualityIssues = buildEmployeeDataQualityIssues;
