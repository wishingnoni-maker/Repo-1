import type { Pool } from "pg";
import type {
  Client,
  ClientFilters,
  ClientInput,
  PaginatedClients
} from "../types.js";
import {
  createClientRecord,
  matchesClientFilters,
  mergeClientRecord
} from "../utils/client.js";
import { normalizeValue } from "../utils/text.js";
import type { ClientRepository } from "./ClientRepository.js";

type ClientRow = {
  id: string;
  client_name: string;
  status: string | null;
  invoice_currency: string | null;
  client_contact: string | null;
  client_manager: string | null;
  client_description: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const toIsoString = (value: Date | string) => new Date(value).toISOString();

const mapClientRow = (row: ClientRow): Client => ({
  id: row.id,
  clientName: row.client_name,
  clientStatus: row.status ?? "",
  clientInvoiceCurrency: row.invoice_currency ?? "",
  clientContact: row.client_contact ?? "",
  clientManager: row.client_manager ?? "",
  clientDescription: row.client_description ?? "",
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at)
});

const clientKey = (value: string) => normalizeValue(value).toLowerCase();

const sortClients = (clients: Client[]) =>
  [...clients].sort((a, b) => a.clientName.localeCompare(b.clientName));

export class PostgresClientRepository implements ClientRepository {
  constructor(private readonly pool: Pool) {}

  async getAll(): Promise<Client[]> {
    const result = await this.pool.query<ClientRow>(`
      SELECT
        id,
        client_name,
        status,
        invoice_currency,
        client_contact,
        client_manager,
        client_description,
        created_at,
        updated_at
      FROM clients
      ORDER BY client_name ASC
    `);

    return result.rows.map(mapClientRow);
  }

  async saveAll(clients: Client[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM clients");

      for (const record of clients) {
        await client.query(
          `
            INSERT INTO clients (
              id,
              client_name,
              status,
              invoice_currency,
              client_contact,
              client_manager,
              client_description,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            record.id,
            record.clientName,
            record.clientStatus,
            record.clientInvoiceCurrency,
            record.clientContact,
            record.clientManager,
            record.clientDescription,
            record.createdAt,
            record.updatedAt
          ]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async query(filters: ClientFilters): Promise<PaginatedClients> {
    const clients = await this.getAll();
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 10;
    const filtered = sortClients(clients.filter((entry) => matchesClientFilters(entry, filters)));
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
    const result = await this.pool.query<ClientRow>(
      `
        SELECT
          id,
          client_name,
          status,
          invoice_currency,
          client_contact,
          client_manager,
          client_description,
          created_at,
          updated_at
        FROM clients
        WHERE id = $1
      `,
      [id]
    );

    return result.rows[0] ? mapClientRow(result.rows[0]) : null;
  }

  async getByName(name: string): Promise<Client | null> {
    const clients = await this.getAll();
    return clients.find((client) => clientKey(client.clientName) === clientKey(name)) ?? null;
  }

  async create(input: ClientInput): Promise<Client> {
    const created = createClientRecord(input);
    const result = await this.pool.query<ClientRow>(
      `
        INSERT INTO clients (
          id,
          client_name,
          status,
          invoice_currency,
          client_contact,
          client_manager,
          client_description,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
          id,
          client_name,
          status,
          invoice_currency,
          client_contact,
          client_manager,
          client_description,
          created_at,
          updated_at
      `,
      [
        created.id,
        created.clientName,
        created.clientStatus,
        created.clientInvoiceCurrency,
        created.clientContact,
        created.clientManager,
        created.clientDescription,
        created.createdAt,
        created.updatedAt
      ]
    );

    return mapClientRow(result.rows[0]);
  }

  async update(id: string, input: Partial<ClientInput>): Promise<Client | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }
    const updated = mergeClientRecord(existing, input);
    const result = await this.pool.query<ClientRow>(
      `
        UPDATE clients
        SET
          client_name = $2,
          status = $3,
          invoice_currency = $4,
          client_contact = $5,
          client_manager = $6,
          client_description = $7,
          updated_at = $8
        WHERE id = $1
        RETURNING
          id,
          client_name,
          status,
          invoice_currency,
          client_contact,
          client_manager,
          client_description,
          created_at,
          updated_at
      `,
      [
        id,
        updated.clientName,
        updated.clientStatus,
        updated.clientInvoiceCurrency,
        updated.clientContact,
        updated.clientManager,
        updated.clientDescription,
        updated.updatedAt
      ]
    );
    return mapClientRow(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM clients WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
