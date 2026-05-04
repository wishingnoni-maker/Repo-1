import type {
  Client,
  ClientFilters,
  ClientInput,
  PaginatedClients
} from "../types.js";
import {
  createClientRecord,
  mergeClientRecord,
  matchesClientFilters
} from "../utils/client.js";
import { normalizeValue } from "../utils/text.js";
import { readJsonCollection, writeJsonCollection } from "../services/jsonStore.js";
import type { ClientRepository } from "./ClientRepository.js";

const clientKey = (value: string) => normalizeValue(value).toLowerCase();

const sortClients = (clients: Client[]) =>
  [...clients].sort((a, b) => a.clientName.localeCompare(b.clientName));

export class JsonClientRepository implements ClientRepository {
  constructor(
    private readonly filePath: string,
    private readonly dataKey: string = "clients"
  ) {}

  async getAll(): Promise<Client[]> {
    return readJsonCollection<Client>(this.filePath, this.dataKey);
  }

  async saveAll(clients: Client[]): Promise<void> {
    await writeJsonCollection(this.filePath, this.dataKey, clients);
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
}
