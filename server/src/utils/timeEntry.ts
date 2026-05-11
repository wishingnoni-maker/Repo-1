import { z } from "zod";
import type {
  Client,
  Project,
  TimeEntry,
  TimeEntryFilters,
  TimeEntryInput
} from "../types.js";
import { normalizeValue, slugifyName } from "./text.js";

export const timeEntryCategories = [
  "Client Work",
  "Project Management",
  "Internal Meeting",
  "Research",
  "Admin",
  "Support",
  "Travel",
  "Other"
] as const;

const parseHours = (value: unknown): number => {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return Number.NaN;
  }
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const parseNullableString = (value: unknown): string | null => {
  const normalized = normalizeValue(value);
  return normalized || null;
};

const parseBillable = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = normalizeValue(value).toLowerCase();
  if (!normalized) {
    return true;
  }
  return normalized !== "false" && normalized !== "0" && normalized !== "no";
};

const parseWorkDate = (value: unknown): string => {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return "";
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }
  return parsed.toISOString().slice(0, 10);
};

export const timeEntryInputSchema = z.object({
  employeeId: z.string().uuid("Employee is required"),
  projectId: z.string().uuid("Project is required"),
  clientId: z.string().uuid().nullable().default(null),
  workDate: z.string().min(1, "Work date is required"),
  hours: z.number().gt(0, "Hours must be greater than 0").max(24, "Hours must be 24 or less"),
  workCategory: z.string().min(1).default("Client Work"),
  billable: z.boolean().default(true),
  notes: z.string().max(1000, "Notes must be 1000 characters or fewer").default("")
});

export const normalizeTimeEntryInput = (input: Partial<Record<keyof TimeEntryInput, unknown>>): TimeEntryInput => ({
  employeeId: normalizeValue(input.employeeId),
  projectId: normalizeValue(input.projectId),
  clientId: parseNullableString(input.clientId),
  workDate: parseWorkDate(input.workDate),
  hours: parseHours(input.hours),
  workCategory: normalizeValue(input.workCategory) || "Client Work",
  billable: parseBillable(input.billable),
  notes: normalizeValue(input.notes)
});

export const normalizePartialTimeEntryInput = (
  input: Partial<Record<keyof TimeEntryInput, unknown>>
): Partial<TimeEntryInput> => {
  const normalized: Partial<TimeEntryInput> = {};
  const has = <K extends keyof TimeEntryInput>(key: K) =>
    Object.prototype.hasOwnProperty.call(input, key);

  if (has("employeeId")) {
    normalized.employeeId = normalizeValue(input.employeeId);
  }
  if (has("projectId")) {
    normalized.projectId = normalizeValue(input.projectId);
  }
  if (has("clientId")) {
    normalized.clientId = parseNullableString(input.clientId);
  }
  if (has("workDate")) {
    normalized.workDate = parseWorkDate(input.workDate);
  }
  if (has("hours")) {
    normalized.hours = parseHours(input.hours);
  }
  if (has("workCategory")) {
    normalized.workCategory = normalizeValue(input.workCategory) || "Client Work";
  }
  if (has("billable")) {
    normalized.billable = parseBillable(input.billable);
  }
  if (has("notes")) {
    normalized.notes = normalizeValue(input.notes);
  }

  return normalized;
};

export const matchesTimeEntryFilters = (entry: TimeEntry, filters: TimeEntryFilters): boolean => {
  const search = normalizeValue(filters.search).toLowerCase();
  if (search) {
    const haystack = [
      entry.employeeName,
      entry.employeeEmail,
      entry.projectName,
      entry.clientName,
      entry.projectManager,
      entry.workCategory,
      entry.notes
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(search)) {
      return false;
    }
  }

  if (filters.employeeId && entry.employeeId !== filters.employeeId) {
    return false;
  }
  if (filters.clientId && entry.clientId !== filters.clientId) {
    return false;
  }
  if (filters.projectId && entry.projectId !== filters.projectId) {
    return false;
  }
  if (typeof filters.billable === "boolean" && entry.billable !== filters.billable) {
    return false;
  }
  if (filters.workCategory && entry.workCategory !== filters.workCategory) {
    return false;
  }
  if (filters.startDate && entry.workDate < filters.startDate) {
    return false;
  }
  if (filters.endDate && entry.workDate > filters.endDate) {
    return false;
  }

  return true;
};

export const sortTimeEntries = (
  entries: TimeEntry[],
  sortBy: TimeEntryFilters["sortBy"] = "workDate",
  sortDirection: TimeEntryFilters["sortDirection"] = "desc"
) => {
  const direction = sortDirection === "asc" ? 1 : -1;

  return [...entries].sort((a, b) => {
    switch (sortBy) {
      case "hours":
        return (a.hours - b.hours) * direction;
      case "employeeName":
        return a.employeeName.localeCompare(b.employeeName) * direction;
      case "projectName":
        return a.projectName.localeCompare(b.projectName) * direction;
      case "createdAt":
        return a.createdAt.localeCompare(b.createdAt) * direction;
      case "workDate":
      default:
        return a.workDate.localeCompare(b.workDate) * direction;
    }
  });
};

const activeStatuses = new Set([
  "active",
  "in progress",
  "open",
  "current",
  "ongoing",
  "started"
]);

export const isEligibleTimeTrackingProject = (project: Project, now = new Date()) => {
  const fiveYearsAgo = new Date(now);
  fiveYearsAgo.setUTCFullYear(fiveYearsAgo.getUTCFullYear() - 5);

  const start = project.projectStartDate ? new Date(project.projectStartDate) : null;
  const end = project.projectEndDate ? new Date(project.projectEndDate) : null;
  const status = normalizeValue(project.projectStatus).toLowerCase();

  if (start && !Number.isNaN(start.getTime()) && start >= fiveYearsAgo) {
    return true;
  }
  if (end && !Number.isNaN(end.getTime()) && end >= fiveYearsAgo) {
    return true;
  }
  if (activeStatuses.has(status)) {
    return true;
  }
  if (!end && start && !Number.isNaN(start.getTime()) && start >= fiveYearsAgo) {
    return true;
  }

  return false;
};

export const findLikelyClientForProject = (project: Project, clients: Client[]): Client | null => {
  const projectKey = slugifyName(project.projectName);
  const matches = clients.filter((client) => {
    const clientKey = slugifyName(client.clientName);
    return clientKey && projectKey.includes(clientKey);
  });

  if (!matches.length) {
    return null;
  }

  return [...matches].sort((a, b) => b.clientName.length - a.clientName.length)[0];
};
