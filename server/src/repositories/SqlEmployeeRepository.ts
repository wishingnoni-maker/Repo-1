import sqlPkg from "mssql";
import type {
  BulkUpdatePayload,
  Employee,
  EmployeeFilters,
  EmployeeInput,
  PaginatedEmployees
} from "../types.js";
import { createEmployeeRecord, matchesFilters, mergeEmployeeRecord, sortEmployees } from "../utils/employee.js";
import type { EmployeeRepository } from "./EmployeeRepository.js";

const sql = sqlPkg as any;

export class SqlEmployeeRepository implements EmployeeRepository {
  private poolPromise: Promise<any>;

  constructor(poolConfig: Record<string, unknown>) {
    this.poolPromise = sql.connect(poolConfig);
  }

  private async getPool() {
    return this.poolPromise;
  }

  private mapRecord(record: any): Employee {
    return {
      id: record.id,
      firstName: record.firstName ?? "",
      lastName: record.lastName ?? "",
      fullName: record.fullName ?? "",
      email: record.email ?? "",
      title: record.title ?? "",
      employeeRegion: record.employeeRegion ?? "",
      supervisorName: record.supervisorName ?? "",
      employeeCell: record.employeeCell ?? "",
      country: record.country ?? "",
      titleCode: record.titleCode ?? "",
      hireDate: record.hireDate ? new Date(record.hireDate).toISOString().slice(0, 10) : null,
      createdAt: new Date(record.createdAt).toISOString(),
      updatedAt: new Date(record.updatedAt).toISOString()
    };
  }

  async getAll(): Promise<Employee[]> {
    const pool = await this.getPool();
    const result = await pool.request().query("SELECT * FROM Employees");
    return result.recordset.map((row: any) => this.mapRecord(row));
  }

  async getById(id: string): Promise<Employee | null> {
    const pool = await this.getPool();
    const result = await pool.request().input("id", sql.NVarChar, id).query("SELECT * FROM Employees WHERE id = @id");
    return result.recordset[0] ? this.mapRecord(result.recordset[0]) : null;
  }

  async getByEmail(email: string): Promise<Employee | null> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input("email", sql.NVarChar, email.toLowerCase())
      .query("SELECT * FROM Employees WHERE email = @email");
    return result.recordset[0] ? this.mapRecord(result.recordset[0]) : null;
  }

  async query(filters: EmployeeFilters): Promise<PaginatedEmployees> {
    const all = await this.getAll();
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 10;
    const filtered = sortEmployees(
      all.filter((employee) => matchesFilters(employee, filters)),
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
    const employee = createEmployeeRecord(input);
    const pool = await this.getPool();
    await pool
      .request()
      .input("id", sql.NVarChar, employee.id)
      .input("firstName", sql.NVarChar, employee.firstName)
      .input("lastName", sql.NVarChar, employee.lastName)
      .input("fullName", sql.NVarChar, employee.fullName)
      .input("email", sql.NVarChar, employee.email)
      .input("title", sql.NVarChar, employee.title)
      .input("employeeRegion", sql.NVarChar, employee.employeeRegion)
      .input("supervisorName", sql.NVarChar, employee.supervisorName)
      .input("employeeCell", sql.NVarChar, employee.employeeCell)
      .input("country", sql.NVarChar, employee.country)
      .input("titleCode", sql.NVarChar, employee.titleCode)
      .input("hireDate", sql.Date, employee.hireDate)
      .input("createdAt", sql.DateTime2, employee.createdAt)
      .input("updatedAt", sql.DateTime2, employee.updatedAt)
      .query(`
        INSERT INTO Employees (
          id, firstName, lastName, fullName, email, title,
          employeeRegion, supervisorName, employeeCell, country,
          titleCode, hireDate, createdAt, updatedAt
        )
        VALUES (
          @id, @firstName, @lastName, @fullName, @email, @title,
          @employeeRegion, @supervisorName, @employeeCell, @country,
          @titleCode, @hireDate, @createdAt, @updatedAt
        )
      `);
    return employee;
  }

  async update(id: string, input: Partial<EmployeeInput>): Promise<Employee | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }
    const updated = mergeEmployeeRecord(existing, input);
    const pool = await this.getPool();
    await pool
      .request()
      .input("id", sql.NVarChar, id)
      .input("firstName", sql.NVarChar, updated.firstName)
      .input("lastName", sql.NVarChar, updated.lastName)
      .input("fullName", sql.NVarChar, updated.fullName)
      .input("email", sql.NVarChar, updated.email)
      .input("title", sql.NVarChar, updated.title)
      .input("employeeRegion", sql.NVarChar, updated.employeeRegion)
      .input("supervisorName", sql.NVarChar, updated.supervisorName)
      .input("employeeCell", sql.NVarChar, updated.employeeCell)
      .input("country", sql.NVarChar, updated.country)
      .input("titleCode", sql.NVarChar, updated.titleCode)
      .input("hireDate", sql.Date, updated.hireDate)
      .input("updatedAt", sql.DateTime2, updated.updatedAt)
      .query(`
        UPDATE Employees
        SET firstName = @firstName,
            lastName = @lastName,
            fullName = @fullName,
            email = @email,
            title = @title,
            employeeRegion = @employeeRegion,
            supervisorName = @supervisorName,
            employeeCell = @employeeCell,
            country = @country,
            titleCode = @titleCode,
            hireDate = @hireDate,
            updatedAt = @updatedAt
        WHERE id = @id
      `);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const pool = await this.getPool();
    const result = await pool.request().input("id", sql.NVarChar, id).query("DELETE FROM Employees WHERE id = @id");
    return result.rowsAffected[0] > 0;
  }

  async bulkDelete(ids: string[]): Promise<number> {
    if (!ids.length) {
      return 0;
    }
    const deleted = await Promise.all(ids.map((id) => this.delete(id)));
    return deleted.filter(Boolean).length;
  }

  async bulkUpdate(payload: BulkUpdatePayload): Promise<number> {
    const updates = await Promise.all(payload.ids.map((id) => this.update(id, payload.updates)));
    return updates.filter(Boolean).length;
  }

  async upsertMany(
    inputs: EmployeeInput[],
    mode: "insert-only" | "upsert"
  ): Promise<Array<{ status: "imported" | "updated" | "skipped"; employee: EmployeeInput; reason?: string }>> {
    const results: Array<{ status: "imported" | "updated" | "skipped"; employee: EmployeeInput; reason?: string }> = [];

    for (const input of inputs) {
      const existing = await this.getByEmail(input.email);
      if (!existing) {
        await this.create(input);
        results.push({ status: "imported", employee: input });
        continue;
      }

      if (mode === "insert-only") {
        results.push({ status: "skipped", employee: input, reason: "duplicate_email" });
        continue;
      }

      await this.update(existing.id, input);
      results.push({ status: "updated", employee: input });
    }

    return results;
  }
}
