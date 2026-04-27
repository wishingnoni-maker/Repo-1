export const normalizeHeader = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

export const normalizeValue = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value).trim();

export const slugifyName = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, " ").trim();
