import type {
  PaginatedTimeEntries,
  TimeEntry,
  TimeEntryFilters,
  TimeEntryInput
} from "../types.js";

export interface TimeEntryRepository {
  getAll(): Promise<TimeEntry[]>;
  query(filters: TimeEntryFilters): Promise<PaginatedTimeEntries>;
  getById(id: string): Promise<TimeEntry | null>;
  create(input: TimeEntryInput): Promise<TimeEntry>;
  update(id: string, input: Partial<TimeEntryInput>): Promise<TimeEntry | null>;
  delete(id: string): Promise<boolean>;
}
