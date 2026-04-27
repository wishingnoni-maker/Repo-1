import type {
  BulkUpdatePayload,
  Employee,
  EmployeeFilters,
  EmployeeInput,
  PaginatedEmployees
} from "../types.js";

export interface EmployeeRepository {
  getAll(): Promise<Employee[]>;
  getById(id: string): Promise<Employee | null>;
  getByEmail(email: string): Promise<Employee | null>;
  query(filters: EmployeeFilters): Promise<PaginatedEmployees>;
  create(input: EmployeeInput): Promise<Employee>;
  update(id: string, input: Partial<EmployeeInput>): Promise<Employee | null>;
  delete(id: string): Promise<boolean>;
  bulkDelete(ids: string[]): Promise<number>;
  bulkUpdate(payload: BulkUpdatePayload): Promise<number>;
  upsertMany(
    inputs: EmployeeInput[],
    mode: "insert-only" | "upsert"
  ): Promise<Array<{ status: "imported" | "updated" | "skipped"; employee: EmployeeInput; reason?: string }>>;
}
