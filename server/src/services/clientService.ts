import type {
  Client,
  ClientFilters,
  ClientInput,
  ClientSummary,
  ImportSummary,
  PaginatedClients
} from "../types.js";
import type { ClientRepository } from "../repositories/ClientRepository.js";
import { createClientRepository } from "../repositories/index.js";
import { groupCounts } from "../utils/employee.js";
import {
  clientInputSchema,
  findMissingClientFields,
  mapRowToClientInput,
  normalizeClientInput
} from "../utils/client.js";
import { readRowsFromWorkbook } from "./importService.js";
import { normalizeValue } from "../utils/text.js";

const clientKey = (value: string) => normalizeValue(value).toLowerCase();

export class ClientService {
  constructor(private readonly repository: ClientRepository = createClientRepository()) {}

  async getAll(): Promise<Client[]> {
    return this.repository.getAll();
  }

  async saveAll(clients: Client[]): Promise<void> {
    await this.repository.saveAll(clients);
  }

  async query(filters: ClientFilters): Promise<PaginatedClients> {
    return this.repository.query(filters);
  }

  async getById(id: string): Promise<Client | null> {
    return this.repository.getById(id);
  }

  async getByName(name: string): Promise<Client | null> {
    return this.repository.getByName(name);
  }

  async create(input: ClientInput): Promise<Client> {
    return this.repository.create(input);
  }

  async update(id: string, input: Partial<ClientInput>): Promise<Client | null> {
    return this.repository.update(id, input);
  }

  async delete(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  async importFromWorkbook(
    fileBuffer: Buffer,
    fileName: string,
    mode: "replace" | "upsert"
  ): Promise<ImportSummary> {
    const rows = readRowsFromWorkbook(fileBuffer, fileName);
    const validRows: Array<{ rowNumber: number; data: ClientInput }> = [];
    const duplicateRows: string[] = [];
    const errors: string[] = [];
    const missingRequiredFields: ImportSummary["missingRequiredFields"] = [];
    const results: ImportSummary["results"] = [];

    const existing = mode === "replace" ? [] : await this.getAll();
    const existingByName = new Map(existing.map((client) => [clientKey(client.clientName), client]));

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const mapped = mapRowToClientInput(row);
      const missing = findMissingClientFields(mapped);

      if (missing.length) {
        missingRequiredFields.push({ rowNumber, fields: missing });
        results.push({ rowNumber, status: "skipped", key: mapped.clientName, reason: "missing_required_fields" });
        continue;
      }

      const parsed = clientInputSchema.safeParse(mapped);
      if (!parsed.success) {
        const reason = parsed.error.issues.map((issue) => issue.message).join(", ");
        errors.push(`Row ${rowNumber}: ${reason}`);
        results.push({ rowNumber, status: "skipped", key: mapped.clientName, reason });
        continue;
      }

      const key = clientKey(parsed.data.clientName);
      const known = existingByName.get(key);
      if (known && mode !== "replace") {
        duplicateRows.push(parsed.data.clientName);
      }

      validRows.push({ rowNumber, data: parsed.data });
    }

    const nextClients = mode === "replace" ? [] : [...existing];
    const nextByName = new Map(nextClients.map((client) => [clientKey(client.clientName), client]));
    let importedRows = 0;
    let updatedRows = 0;

    validRows.forEach(({ rowNumber, data }) => {
      const key = clientKey(data.clientName);
      const current = nextByName.get(key);
      if (!current) {
        const timestamp = new Date().toISOString();
        const created: Client = {
          id: crypto.randomUUID(),
          ...data,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        nextClients.push(created);
        nextByName.set(key, created);
        importedRows += 1;
        results.push({ rowNumber, status: "imported", key: data.clientName });
        return;
      }

      const updated: Client = {
        ...current,
        ...normalizeClientInput(data),
        updatedAt: new Date().toISOString()
      };
      const index = nextClients.findIndex((client) => client.id === current.id);
      nextClients[index] = updated;
      nextByName.set(key, updated);
      updatedRows += 1;
      results.push({ rowNumber, status: "updated", key: data.clientName });
    });

    await this.saveAll(nextClients);

    return {
      totalRows: rows.length,
      importedRows,
      updatedRows,
      skippedRows: results.filter((result) => result.status === "skipped").length,
      duplicateRows,
      errors,
      missingRequiredFields,
      results
    };
  }

  buildSummary(clients: Client[]): ClientSummary {
    return {
      totalClients: clients.length,
      activeClients: clients.filter((client) => client.clientStatus.toLowerCase() === "active").length,
      inactiveOrOtherClients: clients.filter((client) => client.clientStatus.toLowerCase() !== "active").length,
      clientsMissingContact: clients.filter((client) => !client.clientContact).length,
      clientsMissingDescription: clients.filter((client) => !client.clientDescription).length,
      clientsMissingManager: clients.filter((client) => !client.clientManager).length
    };
  }

  buildStatusCounts(clients: Client[]) {
    return groupCounts(clients.map((client) => client.clientStatus));
  }
}
