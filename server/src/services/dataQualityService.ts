import type { DataQualityIssue, Employee } from "../types.js";
import { normalizeSupervisorKey } from "../utils/employee.js";

const phonePattern = /^[+\d()\-\s.]{7,20}$/;

export const buildDataQualityIssues = (employees: Employee[]): DataQualityIssue[] => {
  const issues: DataQualityIssue[] = [];
  const emailCounts = employees.reduce((map, employee) => {
    const key = employee.email.toLowerCase();
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  const employeeNameKeys = new Set(employees.map((employee) => normalizeSupervisorKey(employee.fullName)));

  employees.forEach((employee) => {
    if (!employee.email) {
      issues.push({
        type: "missing_email",
        severity: "error",
        employeeId: employee.id,
        employeeName: employee.fullName,
        message: "Employee is missing an email address."
      });
    }

    if (employee.email && (emailCounts.get(employee.email.toLowerCase()) ?? 0) > 1) {
      issues.push({
        type: "duplicate_email",
        severity: "error",
        employeeId: employee.id,
        employeeName: employee.fullName,
        email: employee.email,
        message: "Employee email appears more than once."
      });
    }

    if (!employee.title) {
      issues.push({
        type: "missing_title",
        severity: "warning",
        employeeId: employee.id,
        employeeName: employee.fullName,
        message: "Employee is missing a title."
      });
    }

    if (!employee.supervisorName) {
      issues.push({
        type: "missing_supervisor",
        severity: "warning",
        employeeId: employee.id,
        employeeName: employee.fullName,
        message: "Employee does not have a supervisor listed."
      });
    }

    if (employee.hireDate === null) {
      issues.push({
        type: "invalid_hire_date",
        severity: "warning",
        employeeId: employee.id,
        employeeName: employee.fullName,
        message: "Hire date is missing or invalid."
      });
    }

    if (!employee.country || !employee.employeeRegion) {
      issues.push({
        type: "missing_region_or_country",
        severity: "warning",
        employeeId: employee.id,
        employeeName: employee.fullName,
        message: "Employee is missing region or country."
      });
    }

    if (employee.employeeCell && !phonePattern.test(employee.employeeCell)) {
      issues.push({
        type: "phone_format",
        severity: "warning",
        employeeId: employee.id,
        employeeName: employee.fullName,
        message: "Employee cell number format looks unusual."
      });
    }

    if (employee.titleCode && !employee.title) {
      issues.push({
        type: "title_code_without_title",
        severity: "warning",
        employeeId: employee.id,
        employeeName: employee.fullName,
        message: "Title code exists without a matching title."
      });
    }

    if (employee.supervisorName && !employeeNameKeys.has(normalizeSupervisorKey(employee.supervisorName))) {
      issues.push({
        type: "supervisor_not_found",
        severity: "warning",
        employeeId: employee.id,
        employeeName: employee.fullName,
        message: "Supervisor name does not match any employee in the directory."
      });
    }
  });

  return issues;
};
