import type {
  Client,
  ClientFilters,
  ClientInput,
  PaginatedClients
} from "../types.js";

export interface ClientRepository {
  getAll(): Promise<Client[]>;
  saveAll(clients: Client[]): Promise<void>;
  query(filters: ClientFilters): Promise<PaginatedClients>;
  getById(id: string): Promise<Client | null>;
  getByName(name: string): Promise<Client | null>;
  create(input: ClientInput): Promise<Client>;
  update(id: string, input: Partial<ClientInput>): Promise<Client | null>;
  delete(id: string): Promise<boolean>;
}
