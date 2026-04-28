import type { Client, DashboardSummary, Employee, Project } from "../types.js";
import {
  buildClientDataQualityIssues,
  buildEmployeeDataQualityIssues,
  buildProjectDataQualityIssues
} from "./dataQualityService.js";
import { groupCounts, normalizeSupervisorKey } from "../utils/employee.js";

export const buildDashboardSummary = (
  employees: Employee[],
  clients: Client[],
  projects: Project[]
): DashboardSummary => {
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
    totalClients: clients.length,
    totalProjects: projects.length,
    activeProjects: projects.filter((project) => project.projectStatus.toLowerCase() === "active").length,
    projectsMissingPoNumber: projects.filter((project) => !project.poNumber).length,
    clientsMissingManager: clients.filter((client) => !client.clientManager).length,
    employeesByRegion: groupCounts(employees.map((employee) => employee.employeeRegion)),
    employeesByCountry: groupCounts(employees.map((employee) => employee.country)),
    employeesByTitle: groupCounts(employees.map((employee) => employee.title)),
    employeesByTitleCode: groupCounts(employees.map((employee) => employee.titleCode)),
    newestHires,
    longestTenuredEmployees,
    largestSupervisorTeams: Array.from(supervisorCounts.values())
      .sort((a, b) => b.teamSize - a.teamSize || a.supervisorName.localeCompare(b.supervisorName))
      .slice(0, 10),
    missingDataWarnings: [
      ...buildEmployeeDataQualityIssues(employees),
      ...buildClientDataQualityIssues(clients),
      ...buildProjectDataQualityIssues(projects)
    ].slice(0, 10)
  };
};
