import { stringify } from "csv-stringify/sync";
import type { DataQualityIssue, Employee } from "../types.js";

export const employeesToCsv = (employees: Employee[]): string =>
  stringify(
    employees.map((employee) => ({
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      fullName: employee.fullName,
      email: employee.email,
      title: employee.title,
      employeeRegion: employee.employeeRegion,
      supervisorName: employee.supervisorName,
      employeeCell: employee.employeeCell,
      country: employee.country,
      titleCode: employee.titleCode,
      hireDate: employee.hireDate,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt
    })),
    { header: true }
  );

export const issuesToCsv = (issues: DataQualityIssue[]): string =>
  stringify(issues, { header: true });

export const supervisorTeamsToCsv = (
  rows: Array<{ supervisorName: string; teamSize: number; region: string; country: string }>
): string => stringify(rows, { header: true });
