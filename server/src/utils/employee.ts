import { z } from "zod";
import type { Employee, EmployeeFilters, EmployeeInput, SortField } from "../types.js";
import { getTenureYears, parseDateInput } from "./date.js";
import { normalizeHeader, normalizeValue, slugifyName } from "./text.js";

const requiredFields = ["fullName", "email"] as const;

const headerAliases: Record<string, keyof EmployeeInput | "ignore"> = {
  userfirstname: "firstName",
  firstname: "firstName",
  userlastname: "lastName",
  lastname: "lastName",
  name: "fullName",
  fullname: "fullName",
  useremail: "email",
  email: "email",
  title: "title",
  employeeregion: "employeeRegion",
  region: "employeeRegion",
  usersupervisorname: "supervisorName",
  usersupervisornamecurrent: "supervisorName",
  supervisorname: "supervisorName",
  employeecell: "employeeCell",
  cell: "employeeCell",
  country: "country",
  titlecode: "titleCode",
  hiredate: "hireDate"
};

export const employeeInputSchema = z.object({
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email is required"),
  title: z.string().default(""),
  employeeRegion: z.string().default(""),
  supervisorName: z.string().default(""),
  employeeCell: z.string().default(""),
  country: z.string().default(""),
  titleCode: z.string().default(""),
  hireDate: z.string().nullable().default(null)
});

export const createEmployeeRecord = (input: EmployeeInput): Employee => {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    ...input,
    email: input.email.toLowerCase(),
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

export const mergeEmployeeRecord = (
  existing: Employee,
  input: Partial<EmployeeInput>
): Employee => ({
  ...existing,
  ...input,
  email: (input.email ?? existing.email).toLowerCase(),
  updatedAt: new Date().toISOString()
});

export const normalizeEmployeeInput = (input: Partial<EmployeeInput>): EmployeeInput => {
  const fullName = normalizeValue(input.fullName);
  const firstName = normalizeValue(input.firstName);
  const lastName = normalizeValue(input.lastName);

  const derivedNames =
    !firstName && !lastName && fullName
      ? {
          firstName: fullName.split(" ")[0] ?? "",
          lastName: fullName.split(" ").slice(1).join(" ")
        }
      : { firstName, lastName };

  return {
    firstName: derivedNames.firstName,
    lastName: derivedNames.lastName,
    fullName: fullName || [firstName, lastName].filter(Boolean).join(" ").trim(),
    email: normalizeValue(input.email).toLowerCase(),
    title: normalizeValue(input.title),
    employeeRegion: normalizeValue(input.employeeRegion),
    supervisorName: normalizeSupervisorDisplayName(input.supervisorName),
    employeeCell: normalizeValue(input.employeeCell),
    country: normalizeValue(input.country),
    titleCode: normalizeValue(input.titleCode),
    hireDate: parseDateInput(input.hireDate)
  };
};

export const normalizePartialEmployeeInput = (
  input: Partial<EmployeeInput>
): Partial<EmployeeInput> => {
  const normalized: Partial<EmployeeInput> = {};
  const has = <K extends keyof EmployeeInput>(key: K) =>
    Object.prototype.hasOwnProperty.call(input, key);

  if (has("fullName") || has("firstName") || has("lastName")) {
    const fullName = has("fullName") ? normalizeValue(input.fullName) : "";
    const firstName = has("firstName") ? normalizeValue(input.firstName) : "";
    const lastName = has("lastName") ? normalizeValue(input.lastName) : "";

    if (has("fullName")) {
      normalized.fullName = fullName || [firstName, lastName].filter(Boolean).join(" ").trim();
    }
    if (has("firstName")) {
      normalized.firstName = firstName;
    }
    if (has("lastName")) {
      normalized.lastName = lastName;
    }
  }

  if (has("email")) {
    normalized.email = normalizeValue(input.email).toLowerCase();
  }
  if (has("title")) {
    normalized.title = normalizeValue(input.title);
  }
  if (has("employeeRegion")) {
    normalized.employeeRegion = normalizeValue(input.employeeRegion);
  }
  if (has("supervisorName")) {
    normalized.supervisorName = normalizeSupervisorDisplayName(input.supervisorName);
  }
  if (has("employeeCell")) {
    normalized.employeeCell = normalizeValue(input.employeeCell);
  }
  if (has("country")) {
    normalized.country = normalizeValue(input.country);
  }
  if (has("titleCode")) {
    normalized.titleCode = normalizeValue(input.titleCode);
  }
  if (has("hireDate")) {
    normalized.hireDate = parseDateInput(input.hireDate);
  }

  return normalized;
};

export const mapExcelRowToEmployeeInput = (row: Record<string, unknown>): Partial<EmployeeInput> => {
  const mapped: Partial<EmployeeInput> = {};

  Object.entries(row).forEach(([rawHeader, rawValue]) => {
    const normalized = normalizeHeader(rawHeader);
    const targetField = headerAliases[normalized];

    if (!targetField || targetField === "ignore") {
      return;
    }

    mapped[targetField] = rawValue as never;
  });

  return normalizeEmployeeInput(mapped);
};

export const findMissingFields = (input: Partial<EmployeeInput>): string[] =>
  requiredFields.filter((field) => !normalizeValue(input[field]));

export const matchesFilters = (employee: Employee, filters: EmployeeFilters): boolean => {
  const search = normalizeValue(filters.search).toLowerCase();
  const searchHaystack = [
    employee.fullName,
    employee.email,
    employee.title,
    employee.supervisorName,
    employee.employeeRegion,
    employee.country
  ]
    .join(" ")
    .toLowerCase();

  if (search && !searchHaystack.includes(search)) {
    return false;
  }

  if (filters.region && employee.employeeRegion !== filters.region) {
    return false;
  }
  if (filters.country && employee.country !== filters.country) {
    return false;
  }
  if (filters.title && employee.title !== filters.title) {
    return false;
  }
  if (filters.supervisor && employee.supervisorName !== filters.supervisor) {
    return false;
  }
  if (filters.titleCode && employee.titleCode !== filters.titleCode) {
    return false;
  }
  if (filters.hireYear) {
    const hireYear = employee.hireDate ? new Date(employee.hireDate).getUTCFullYear().toString() : "";
    if (hireYear !== filters.hireYear) {
      return false;
    }
  }

  return true;
};

export const sortEmployees = (
  employees: Employee[],
  sortBy: SortField = "name",
  sortDirection: "asc" | "desc" = "asc"
): Employee[] => {
  const direction = sortDirection === "asc" ? 1 : -1;

  return [...employees].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "hireDate":
        comparison = (a.hireDate ?? "").localeCompare(b.hireDate ?? "");
        break;
      case "region":
        comparison = a.employeeRegion.localeCompare(b.employeeRegion);
        break;
      case "title":
        comparison = a.title.localeCompare(b.title);
        break;
      case "tenure":
        comparison = (getTenureYears(a.hireDate) ?? -1) - (getTenureYears(b.hireDate) ?? -1);
        break;
      case "name":
      default:
        comparison = a.fullName.localeCompare(b.fullName);
        break;
    }

    return comparison * direction;
  });
};

export const groupCounts = (values: string[]) =>
  Array.from(
    values
      .filter(Boolean)
      .reduce((map, value) => {
        map.set(value, (map.get(value) ?? 0) + 1);
        return map;
      }, new Map<string, number>())
      .entries()
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

export const normalizeSupervisorKey = (name: string) => slugifyName(name);

export const normalizeSupervisorDisplayName = (value: unknown): string => {
  const normalized = normalizeValue(value);
  if (!normalized.includes(",")) {
    return normalized;
  }

  const parts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return normalized;
  }

  return `${parts.slice(1).join(" ")} ${parts[0]}`.replace(/\s+/g, " ").trim();
};
