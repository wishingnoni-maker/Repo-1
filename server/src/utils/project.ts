import { z } from "zod";
import type { Project, ProjectFilters, ProjectInput } from "../types.js";
import { parseDateInput } from "./date.js";
import { normalizeValue } from "./text.js";

const requiredFields = ["projectName"] as const;

const parseNumericInput = (value: unknown): number | null => {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const getField = (row: Record<string, unknown>, names: string[]) => {
  const normalizedEntries = Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[key.trim().toLowerCase()] = value;
    return acc;
  }, {});

  for (const name of names) {
    const value = normalizedEntries[name.trim().toLowerCase()];
    if (value !== undefined) {
      return value;
    }
  }

  return "";
};

export const projectInputSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  projectEstimatedHrs: z.number().nullable().default(null),
  projectStatus: z.string().default(""),
  projectCurrency: z.string().default(""),
  projectManager: z.string().default(""),
  projectManagerEmail: z.string().default(""),
  projectStartDate: z.string().nullable().default(null),
  projectEndDate: z.string().nullable().default(null),
  projectDescription: z.string().default(""),
  budgetHours: z.number().nullable().default(null),
  budgetCost: z.number().nullable().default(null),
  expenseBudgetProjectCurrency: z.number().nullable().default(null),
  projectRegion: z.string().default(""),
  poNumber: z.string().default(""),
  projectSoldBy: z.string().default(""),
  numberOfResources: z.number().nullable().default(null),
  numberOfWorkWeeks: z.number().nullable().default(null)
});

export const normalizeProjectInput = (
  input: Partial<Record<keyof ProjectInput, unknown>>
): ProjectInput => ({
  projectName: normalizeValue(input.projectName),
  projectEstimatedHrs: parseNumericInput(input.projectEstimatedHrs),
  projectStatus: normalizeValue(input.projectStatus),
  projectCurrency: normalizeValue(input.projectCurrency),
  projectManager: normalizeValue(input.projectManager),
  projectManagerEmail: normalizeValue(input.projectManagerEmail),
  projectStartDate: parseDateInput(input.projectStartDate),
  projectEndDate: parseDateInput(input.projectEndDate),
  projectDescription: normalizeValue(input.projectDescription),
  budgetHours: parseNumericInput(input.budgetHours),
  budgetCost: parseNumericInput(input.budgetCost),
  expenseBudgetProjectCurrency: parseNumericInput(input.expenseBudgetProjectCurrency),
  projectRegion: normalizeValue(input.projectRegion),
  poNumber: normalizeValue(input.poNumber),
  projectSoldBy: normalizeValue(input.projectSoldBy),
  numberOfResources: parseNumericInput(input.numberOfResources),
  numberOfWorkWeeks: parseNumericInput(input.numberOfWorkWeeks)
});

export const mapRowToProjectInput = (row: Record<string, unknown>): ProjectInput => {
  const mapped: Partial<Record<keyof ProjectInput, unknown>> = {
    projectName: getField(row, ["Project Name"]),
    projectEstimatedHrs: getField(row, ["Project Estimated Hrs"]),
    projectStatus: getField(row, ["Project Status"]),
    projectCurrency: getField(row, ["Project Currency"]),
    projectManager: getField(row, ["Project Manager"]),
    projectManagerEmail: getField(row, ["Project Manager Email"]),
    projectStartDate: getField(row, ["Project Start Date"]),
    projectEndDate: getField(row, ["Project End Date"]),
    projectDescription: getField(row, ["Project Description"]),
    budgetHours: getField(row, ["Budget Hours"]),
    budgetCost: getField(row, ["Budget Cost"]),
    expenseBudgetProjectCurrency: getField(row, ["Expense Budget (Project Currency)"]),
    projectRegion: getField(row, ["Project Region"]),
    poNumber: getField(row, ["PO Number"]),
    projectSoldBy: getField(row, ["Project Sold By"]),
    numberOfResources: getField(row, ["Number of Resources"]),
    numberOfWorkWeeks: getField(row, ["Number of Work Weeks"])
  };

  if (process.env.NODE_ENV !== "production" && Math.random() < 0.0001) {
    console.log("normalizeProject sample keys", Object.keys(row));
  }

  return normalizeProjectInput(mapped);
};

export const findMissingProjectFields = (input: Partial<ProjectInput>): string[] =>
  requiredFields.filter((field) => !normalizeValue(input[field]));

export const createProjectRecord = (input: ProjectInput): Project => {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

export const mergeProjectRecord = (existing: Project, input: Partial<ProjectInput>): Project => ({
  ...existing,
  ...normalizeProjectInput(input),
  updatedAt: new Date().toISOString()
});

export const matchesProjectFilters = (project: Project, filters: ProjectFilters): boolean => {
  const search = normalizeValue(filters.search).toLowerCase();
  const haystack = [
    project.projectName,
    project.projectManager,
    project.projectManagerEmail,
    project.poNumber,
    project.projectSoldBy
  ]
    .join(" ")
    .toLowerCase();

  if (search && !haystack.includes(search)) {
    return false;
  }
  if (filters.manager && !normalizeValue(project.projectManager).toLowerCase().includes(filters.manager.toLowerCase())) {
    return false;
  }
  if (filters.managerEmail && !normalizeValue(project.projectManagerEmail).toLowerCase().includes(filters.managerEmail.toLowerCase())) {
    return false;
  }
  if (filters.poNumber && !normalizeValue(project.poNumber).toLowerCase().includes(filters.poNumber.toLowerCase())) {
    return false;
  }
  if (filters.soldBy && !normalizeValue(project.projectSoldBy).toLowerCase().includes(filters.soldBy.toLowerCase())) {
    return false;
  }
  if (filters.projectStatus && project.projectStatus !== filters.projectStatus) {
    return false;
  }
  if (filters.projectRegion && project.projectRegion !== filters.projectRegion) {
    return false;
  }
  if (filters.projectCurrency && project.projectCurrency !== filters.projectCurrency) {
    return false;
  }
  if (filters.missingPoNumber && project.poNumber) {
    return false;
  }
  if (filters.missingManager && project.projectManager) {
    return false;
  }
  if (filters.missingManagerEmail && project.projectManagerEmail) {
    return false;
  }
  if (filters.missingStartDate && project.projectStartDate) {
    return false;
  }
  if (filters.missingEndDate && project.projectEndDate) {
    return false;
  }

  return true;
};
