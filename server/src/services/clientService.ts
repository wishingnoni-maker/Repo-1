import type {
  Client,
  ClientFilters,
  ClientInput,
  ClientSummary,
  ImportSummary,
  PaginatedClients
} from "../types.js";
import { groupCounts } from "../utils/employee.js";
import { resolveServerDataPath } from "../utils/paths.js";
import {
  clientInputSchema,
  createClientRecord,
  findMissingClientFields,
  mapRowToClientInput,
  matchesClientFilters,
  mergeClientRecord,
  normalizeClientInput
} from "../utils/client.js";
import { readJsonCollection, writeJsonCollection } from "./jsonStore.js";
import { readRowsFromWorkbook } from "./importService.js";
import { normalizeValue } from "../utils/text.js";

const DATA_PATH = resolveServerDataPath("clients.json");
const DATA_KEY = "clients";

const clientKey = (value: string) => normalizeValue(value).toLowerCase();

const sortClients = (clients: Client[]) =>
  [...clients].sort((a, b) => a.clientName.localeCompare(b.clientName));

export class ClientService {
  async getAll(): Promise<Client[]> {
    return readJsonCollection<Client>(DATA_PATH, DATA_KEY);
  }

  async saveAll(clients: Client[]): Promise<void> {
    await writeJsonCollection(DATA_PATH, DATA_KEY, clients);
  }

  async query(filters: ClientFilters): Promise<PaginatedClients> {
    const clients = await this.getAll();
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 10;
    const filtered = sortClients(clients.filter((client) => matchesClientFilters(client, filters)));
    const start = (page - 1) * pageSize;
    return {
      data: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize))
    };
  }

  async getById(id: string): Promise<Client | null> {
    const clients = await this.getAll();
    return clients.find((client) => client.id === id) ?? null;
  }

  async getByName(name: string): Promise<Client | null> {
    const clients = await this.getAll();
    return clients.find((client) => clientKey(client.clientName) === clientKey(name)) ?? null;
  }

  async create(input: ClientInput): Promise<Client> {
    const clients = await this.getAll();
    const created = createClientRecord(input);
    clients.push(created);
    await this.saveAll(clients);
    return created;
  }

  async update(id: string, input: Partial<ClientInput>): Promise<Client | null> {
    const clients = await this.getAll();
    const index = clients.findIndex((client) => client.id === id);
    if (index === -1) {
      return null;
    }
    clients[index] = mergeClientRecord(clients[index], input);
    await this.saveAll(clients);
    return clients[index];
  }

  async delete(id: string): Promise<boolean> {
    const clients = await this.getAll();
    const next = clients.filter((client) => client.id !== id);
    if (next.length === clients.length) {
      return false;
    }
    await this.saveAll(next);
    return true;
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
        const created = createClientRecord(data);
        nextClients.push(created);
        nextByName.set(key, created);
        importedRows += 1;
        results.push({ rowNumber, status: "imported", key: data.clientName });
        return;
      }

      const updated = mergeClientRecord(current, data);
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
