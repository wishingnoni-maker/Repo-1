import type { Pool } from "pg";
import type {
  BulkUpdatePayload,
  Employee,
  EmployeeFilters,
  EmployeeInput,
  PaginatedEmployees
} from "../types.js";
import {
  createEmployeeRecord,
  matchesFilters,
  mergeEmployeeRecord,
  sortEmployees
} from "../utils/employee.js";
import type { EmployeeRepository } from "./EmployeeRepository.js";

type EmployeeRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string | null;
  title: string | null;
  employee_region: string | null;
  supervisor_name: string | null;
  employee_cell: string | null;
  country: string | null;
  title_code: string | null;
  hire_date: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const toIsoString = (value: Date | string) => new Date(value).toISOString();

const mapEmployeeRow = (row: EmployeeRow): Employee => ({
  id: row.id,
  firstName: row.first_name ?? "",
  lastName: row.last_name ?? "",
  fullName: row.full_name,
  email: row.email ?? "",
  title: row.title ?? "",
  employeeRegion: row.employee_region ?? "",
  supervisorName: row.supervisor_name ?? "",
  employeeCell: row.employee_cell ?? "",
  country: row.country ?? "",
  titleCode: row.title_code ?? "",
  hireDate: row.hire_date ?? null,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at)
});

export class PostgresEmployeeRepository implements EmployeeRepository {
  constructor(private readonly pool: Pool) {}

  private async getAllMap() {
    const employees = await this.getAll();
    return new Map(employees.map((employee) => [employee.email.toLowerCase(), employee]));
  }

  async getAll(): Promise<Employee[]> {
    const result = await this.pool.query<EmployeeRow>(`
      SELECT
        id,
        first_name,
        last_name,
        full_name,
        email,
        title,
        employee_region,
        supervisor_name,
        employee_cell,
        country,
        title_code,
        hire_date::text AS hire_date,
        created_at,
        updated_at
      FROM employees
      ORDER BY full_name ASC
    `);

    return result.rows.map(mapEmployeeRow);
  }

  async getById(id: string): Promise<Employee | null> {
    const result = await this.pool.query<EmployeeRow>(
      `
        SELECT
          id,
          first_name,
          last_name,
          full_name,
          email,
          title,
          employee_region,
          supervisor_name,
          employee_cell,
          country,
          title_code,
          hire_date::text AS hire_date,
          created_at,
          updated_at
        FROM employees
        WHERE id = $1
      `,
      [id]
    );

    return result.rows[0] ? mapEmployeeRow(result.rows[0]) : null;
  }

  async getByEmail(email: string): Promise<Employee | null> {
    const result = await this.pool.query<EmployeeRow>(
      `
        SELECT
          id,
          first_name,
          last_name,
          full_name,
          email,
          title,
          employee_region,
          supervisor_name,
          employee_cell,
          country,
          title_code,
          hire_date::text AS hire_date,
          created_at,
          updated_at
        FROM employees
        WHERE lower(email) = lower($1)
      `,
      [email]
    );

    return result.rows[0] ? mapEmployeeRow(result.rows[0]) : null;
  }

  async query(filters: EmployeeFilters): Promise<PaginatedEmployees> {
    const employees = await this.getAll();
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 10;
    const filtered = sortEmployees(
      employees.filter((employee) => matchesFilters(employee, filters)),
      filters.sortBy,
      filters.sortDirection
    );
    const start = (page - 1) * pageSize;
    return {
      data: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize))
    };
  }

  async create(input: EmployeeInput): Promise<Employee> {
    const created = createEmployeeRecord(input);
    const result = await this.pool.query<EmployeeRow>(
      `
        INSERT INTO employees (
          id,
          first_name,
          last_name,
          full_name,
          email,
          title,
          employee_region,
          supervisor_name,
          employee_cell,
          country,
          title_code,
          hire_date,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING
          id,
          first_name,
          last_name,
          full_name,
          email,
          title,
          employee_region,
          supervisor_name,
          employee_cell,
          country,
          title_code,
          hire_date::text AS hire_date,
          created_at,
          updated_at
      `,
      [
        created.id,
        created.firstName,
        created.lastName,
        created.fullName,
        created.email,
        created.title,
        created.employeeRegion,
        created.supervisorName,
        created.employeeCell,
        created.country,
        created.titleCode,
        created.hireDate,
        created.createdAt,
        created.updatedAt
      ]
    );

    return mapEmployeeRow(result.rows[0]);
  }

  async update(id: string, input: Partial<EmployeeInput>): Promise<Employee | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const updated = mergeEmployeeRecord(existing, input);
    const result = await this.pool.query<EmployeeRow>(
      `
        UPDATE employees
        SET
          first_name = $2,
          last_name = $3,
          full_name = $4,
          email = $5,
          title = $6,
          employee_region = $7,
          supervisor_name = $8,
          employee_cell = $9,
          country = $10,
          title_code = $11,
          hire_date = $12,
          updated_at = $13
        WHERE id = $1
        RETURNING
          id,
          first_name,
          last_name,
          full_name,
          email,
          title,
          employee_region,
          supervisor_name,
          employee_cell,
          country,
          title_code,
          hire_date::text AS hire_date,
          created_at,
          updated_at
      `,
      [
        id,
        updated.firstName,
        updated.lastName,
        updated.fullName,
        updated.email,
        updated.title,
        updated.employeeRegion,
        updated.supervisorName,
        updated.employeeCell,
        updated.country,
        updated.titleCode,
        updated.hireDate,
        updated.updatedAt
      ]
    );

    return mapEmployeeRow(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM employees WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async bulkDelete(ids: string[]): Promise<number> {
    const result = await this.pool.query("DELETE FROM employees WHERE id = ANY($1::uuid[])", [ids]);
    return result.rowCount ?? 0;
  }

  async bulkUpdate(payload: BulkUpdatePayload): Promise<number> {
    const assignments: string[] = [];
    const values: Array<string> = [];
    let index = 1;

    if (payload.updates.employeeRegion !== undefined) {
      assignments.push(`employee_region = $${index}`);
      values.push(payload.updates.employeeRegion);
      index += 1;
    }
    if (payload.updates.supervisorName !== undefined) {
      assignments.push(`supervisor_name = $${index}`);
      values.push(payload.updates.supervisorName);
      index += 1;
    }
    if (payload.updates.country !== undefined) {
      assignments.push(`country = $${index}`);
      values.push(payload.updates.country);
      index += 1;
    }
    if (payload.updates.title !== undefined) {
      assignments.push(`title = $${index}`);
      values.push(payload.updates.title);
      index += 1;
    }

    assignments.push(`updated_at = $${index}`);
    values.push(new Date().toISOString());
    index += 1;

    const result = await this.pool.query(
      `UPDATE employees SET ${assignments.join(", ")} WHERE id = ANY($${index}::uuid[])`,
      [...values, payload.ids]
    );

    return result.rowCount ?? 0;
  }

  async upsertMany(
    inputs: EmployeeInput[],
    mode: "insert-only" | "upsert"
  ): Promise<Array<{ status: "imported" | "updated" | "skipped"; employee: EmployeeInput; reason?: string }>> {
    const existingByEmail = await this.getAllMap();
    const results: Array<{ status: "imported" | "updated" | "skipped"; employee: EmployeeInput; reason?: string }> = [];
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      for (const input of inputs) {
        const existing = existingByEmail.get(input.email.toLowerCase());
        if (!existing) {
          const created = createEmployeeRecord(input);
          await client.query(
            `
              INSERT INTO employees (
                id,
                first_name,
                last_name,
                full_name,
                email,
                title,
                employee_region,
                supervisor_name,
                employee_cell,
                country,
                title_code,
                hire_date,
                created_at,
                updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `,
            [
              created.id,
              created.firstName,
              created.lastName,
              created.fullName,
              created.email,
              created.title,
              created.employeeRegion,
              created.supervisorName,
              created.employeeCell,
              created.country,
              created.titleCode,
              created.hireDate,
              created.createdAt,
              created.updatedAt
            ]
          );
          existingByEmail.set(created.email.toLowerCase(), created);
          results.push({ status: "imported", employee: input });
          continue;
        }

        if (mode === "insert-only") {
          results.push({ status: "skipped", employee: input, reason: "duplicate_email" });
          continue;
        }

        const updated = mergeEmployeeRecord(existing, input);
        await client.query(
          `
            UPDATE employees
            SET
              first_name = $2,
              last_name = $3,
              full_name = $4,
              email = $5,
              title = $6,
              employee_region = $7,
              supervisor_name = $8,
              employee_cell = $9,
              country = $10,
              title_code = $11,
              hire_date = $12,
              updated_at = $13
            WHERE id = $1
          `,
          [
            updated.id,
            updated.firstName,
            updated.lastName,
            updated.fullName,
            updated.email,
            updated.title,
            updated.employeeRegion,
            updated.supervisorName,
            updated.employeeCell,
            updated.country,
            updated.titleCode,
            updated.hireDate,
            updated.updatedAt
          ]
        );
        existingByEmail.set(updated.email.toLowerCase(), updated);
        results.push({ status: "updated", employee: input });
      }

      await client.query("COMMIT");
      return results;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
