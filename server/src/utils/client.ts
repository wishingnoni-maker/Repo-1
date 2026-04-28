import { z } from "zod";
import type { Client, ClientFilters, ClientInput } from "../types.js";
import { normalizeHeader, normalizeValue } from "./text.js";

const requiredFields = ["clientName"] as const;

const headerAliases: Record<string, keyof ClientInput> = {
  i: "clientName",
  clientname: "clientName",
  clientstatus: "clientStatus",
  clientinvoicecurrency: "clientInvoiceCurrency",
  clientcontact: "clientContact",
  clientdescription: "clientDescription",
  clientmanager: "clientManager"
};

export const clientInputSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientStatus: z.string().default(""),
  clientInvoiceCurrency: z.string().default(""),
  clientContact: z.string().default(""),
  clientDescription: z.string().default(""),
  clientManager: z.string().default("")
});

export const normalizeClientInput = (input: Partial<ClientInput>): ClientInput => ({
  clientName: normalizeValue(input.clientName),
  clientStatus: normalizeValue(input.clientStatus),
  clientInvoiceCurrency: normalizeValue(input.clientInvoiceCurrency),
  clientContact: normalizeValue(input.clientContact),
  clientDescription: normalizeValue(input.clientDescription),
  clientManager: normalizeValue(input.clientManager)
});

export const mapRowToClientInput = (row: Record<string, unknown>): ClientInput => {
  const mapped: Partial<ClientInput> = {};

  Object.entries(row).forEach(([header, value]) => {
    const targetField = headerAliases[normalizeHeader(header)];
    if (targetField) {
      mapped[targetField] = value as never;
    }
  });

  return normalizeClientInput(mapped);
};

export const findMissingClientFields = (input: Partial<ClientInput>): string[] =>
  requiredFields.filter((field) => !normalizeValue(input[field]));

export const createClientRecord = (input: ClientInput): Client => {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

export const mergeClientRecord = (existing: Client, input: Partial<ClientInput>): Client => ({
  ...existing,
  ...normalizeClientInput(input),
  updatedAt: new Date().toISOString()
});

export const matchesClientFilters = (client: Client, filters: ClientFilters): boolean => {
  const search = normalizeValue(filters.search).toLowerCase();
  const haystack = [
    client.clientName,
    client.clientContact,
    client.clientManager,
    client.clientDescription
  ]
    .join(" ")
    .toLowerCase();

  if (search && !haystack.includes(search)) {
    return false;
  }
  if (filters.clientStatus && client.clientStatus !== filters.clientStatus) {
    return false;
  }
  if (filters.clientInvoiceCurrency && client.clientInvoiceCurrency !== filters.clientInvoiceCurrency) {
    return false;
  }
  if (filters.clientManager && client.clientManager !== filters.clientManager) {
    return false;
  }
  if (filters.missingContact && client.clientContact) {
    return false;
  }
  if (filters.missingDescription && client.clientDescription) {
    return false;
  }
  if (filters.missingManager && client.clientManager) {
    return false;
  }

  return true;
};
