import type { DashboardSummary, Employee } from "../types.js";
import { buildDataQualityIssues } from "./dataQualityService.js";
import { groupCounts, normalizeSupervisorKey } from "../utils/employee.js";

export const buildDashboardSummary = (employees: Employee[]): DashboardSummary => {
  const newestHires = [...employees]
    .filter((employee) => employee.hireDate)
    .sort((a, b) => (b.hireDate ?? "").localeCompare(a.hireDate ?? ""))
    .slice(0, 5);

  const longestTenuredEmployees = [...employees]
    .filter((employee) => employee.hireDate)
    .sort((a, b) => (a.hireDate ?? "").localeCompare(b.hireDate ?? ""))
    .slice(0, 5);

  const supervisorCounts = employees.reduce((map, employee) => {
    if (!employee.supervisorName) {
      return map;
    }

    const key = normalizeSupervisorKey(employee.supervisorName);
    map.set(key, {
      supervisorName: employee.supervisorName,
      teamSize: (map.get(key)?.teamSize ?? 0) + 1
    });
    return map;
  }, new Map<string, { supervisorName: string; teamSize: number }>());

  return {
    totalEmployees: employees.length,
    employeesByRegion: groupCounts(employees.map((employee) => employee.employeeRegion)),
    employeesByCountry: groupCounts(employees.map((employee) => employee.country)),
    employeesByTitle: groupCounts(employees.map((employee) => employee.title)),
    employeesByTitleCode: groupCounts(employees.map((employee) => employee.titleCode)),
    newestHires,
    longestTenuredEmployees,
    largestSupervisorTeams: Array.from(supervisorCounts.values())
      .sort((a, b) => b.teamSize - a.teamSize || a.supervisorName.localeCompare(b.supervisorName))
      .slice(0, 10),
    missingDataWarnings: buildDataQualityIssues(employees).slice(0, 10)
  };
};
