import { stringify } from "csv-stringify/sync";
import type { Client, DataQualityIssue, Employee, Project, TimeEntry } from "../types.js";

export const employeesToCsv = (employees: Employee[]): string =>
  stringify(employees, { header: true });

export const clientsToCsv = (clients: Client[]): string =>
  stringify(clients, { header: true });

export const projectsToCsv = (projects: Project[]): string =>
  stringify(projects, { header: true });

export const projectFinancialsToCsv = (projects: Project[]): string =>
  stringify(
    projects.map((project) => ({
      projectName: project.projectName,
      projectCurrency: project.projectCurrency,
      projectEstimatedHrs: project.projectEstimatedHrs,
      budgetHours: project.budgetHours,
      budgetCost: project.budgetCost,
      expenseBudgetProjectCurrency: project.expenseBudgetProjectCurrency,
      poNumber: project.poNumber,
      projectRegion: project.projectRegion,
      projectManager: project.projectManager,
      projectSoldBy: project.projectSoldBy
    })),
    { header: true }
  );

export const issuesToCsv = (issues: DataQualityIssue[]): string =>
  stringify(issues, { header: true });

export const supervisorTeamsToCsv = (
  rows: Array<{ supervisorName: string; teamSize: number; region: string; country: string }>
): string => stringify(rows, { header: true });

export const timeEntriesToCsv = (entries: TimeEntry[]): string =>
  stringify(
    entries.map((entry) => ({
      workDate: entry.workDate,
      employeeName: entry.employeeName,
      employeeEmail: entry.employeeEmail,
      clientName: entry.clientName,
      projectName: entry.projectName,
      projectManager: entry.projectManager,
      hours: entry.hours,
      billable: entry.billable ? "true" : "false",
      workCategory: entry.workCategory,
      notes: entry.notes,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    })),
    { header: true }
  );
