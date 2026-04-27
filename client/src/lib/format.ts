import type { Employee } from "../types";

export const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : "Unknown");

export const getTenureLabel = (employee: Employee) => {
  if (!employee.hireDate) {
    return "Unknown";
  }

  const start = new Date(employee.hireDate).getTime();
  const years = (Date.now() - start) / (1000 * 60 * 60 * 24 * 365.25);
  return `${years.toFixed(1)} yrs`;
};

export const uniqueValues = (values: string[]) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
