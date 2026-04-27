import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  BulkUpdatePayload,
  Employee,
  EmployeeFilters,
  EmployeeInput,
  PaginatedEmployees
} from "../types.js";
import { matchesFilters, sortEmployees, createEmployeeRecord, mergeEmployeeRecord } from "../utils/employee.js";
import type { EmployeeRepository } from "./EmployeeRepository.js";

interface JsonShape {
  employees: Employee[];
}

export class JsonEmployeeRepository implements EmployeeRepository {
  constructor(private readonly filePath: string) {}

  private async ensureFile(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, JSON.stringify({ employees: [] }, null, 2), "utf8");
    }
  }

  private async read(): Promise<JsonShape> {
    await this.ensureFile();
    const raw = await fs.readFile(this.filePath, "utf8");
    return JSON.parse(raw) as JsonShape;
  }

  private async write(data: JsonShape): Promise<void> {
    await this.ensureFile();
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  async getAll(): Promise<Employee[]> {
    const data = await this.read();
    return data.employees;
  }

  async getById(id: string): Promise<Employee | null> {
    const data = await this.read();
    return data.employees.find((employee) => employee.id === id) ?? null;
  }

  async getByEmail(email: string): Promise<Employee | null> {
    const data = await this.read();
    return data.employees.find((employee) => employee.email === email.toLowerCase()) ?? null;
  }

  async query(filters: EmployeeFilters): Promise<PaginatedEmployees> {
    const data = await this.read();
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 10;
    const filtered = sortEmployees(
      data.employees.filter((employee) => matchesFilters(employee, filters)),
      filters.sortBy,
      filters.sortDirection
    );
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);
    return {
      data: paged,
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize))
    };
  }

  async create(input: EmployeeInput): Promise<Employee> {
    const data = await this.read();
    const created = createEmployeeRecord(input);
    data.employees.push(created);
    await this.write(data);
    return created;
  }

  async update(id: string, input: Partial<EmployeeInput>): Promise<Employee | null> {
    const data = await this.read();
    const index = data.employees.findIndex((employee) => employee.id === id);
    if (index === -1) {
      return null;
    }

    data.employees[index] = mergeEmployeeRecord(data.employees[index], input);
    await this.write(data);
    return data.employees[index];
  }

  async delete(id: string): Promise<boolean> {
    const data = await this.read();
    const next = data.employees.filter((employee) => employee.id !== id);
    if (next.length === data.employees.length) {
      return false;
    }
    await this.write({ employees: next });
    return true;
  }

  async bulkDelete(ids: string[]): Promise<number> {
    const data = await this.read();
    const before = data.employees.length;
    const idSet = new Set(ids);
    data.employees = data.employees.filter((employee) => !idSet.has(employee.id));
    await this.write(data);
    return before - data.employees.length;
  }

  async bulkUpdate(payload: BulkUpdatePayload): Promise<number> {
    const data = await this.read();
    const idSet = new Set(payload.ids);
    let updated = 0;
    data.employees = data.employees.map((employee) => {
      if (!idSet.has(employee.id)) {
        return employee;
      }
      updated += 1;
      return mergeEmployeeRecord(employee, payload.updates);
    });
    await this.write(data);
    return updated;
  }

  async upsertMany(
    inputs: EmployeeInput[],
    mode: "insert-only" | "upsert"
  ): Promise<Array<{ status: "imported" | "updated" | "skipped"; employee: EmployeeInput; reason?: string }>> {
    const data = await this.read();
    const results: Array<{ status: "imported" | "updated" | "skipped"; employee: EmployeeInput; reason?: string }> = [];
    const byEmail = new Map(data.employees.map((employee) => [employee.email, employee]));

    inputs.forEach((input) => {
      const existing = byEmail.get(input.email);
      if (!existing) {
        const created = createEmployeeRecord(input);
        data.employees.push(created);
        byEmail.set(created.email, created);
        results.push({ status: "imported", employee: input });
        return;
      }

      if (mode === "insert-only") {
        results.push({ status: "skipped", employee: input, reason: "duplicate_email" });
        return;
      }

      const updated = mergeEmployeeRecord(existing, input);
      data.employees = data.employees.map((employee) => (employee.id === existing.id ? updated : employee));
      byEmail.set(updated.email, updated);
      results.push({ status: "updated", employee: input });
    });

    await this.write(data);
    return results;
  }
}
