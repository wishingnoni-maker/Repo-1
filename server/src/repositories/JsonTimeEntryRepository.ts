import type {
  PaginatedTimeEntries,
  TimeEntry,
  TimeEntryFilters,
  TimeEntryInput
} from "../types.js";
import { readJsonCollection, writeJsonCollection } from "../services/jsonStore.js";
import { matchesTimeEntryFilters, sortTimeEntries } from "../utils/timeEntry.js";
import type { TimeEntryRepository } from "./TimeEntryRepository.js";

const mapCreatedEntry = (input: TimeEntryInput): TimeEntry => {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    employeeId: input.employeeId,
    employeeName: "",
    employeeEmail: "",
    clientId: input.clientId,
    clientName: "",
    projectId: input.projectId,
    projectName: "",
    projectStatus: "",
    projectManager: "",
    workDate: input.workDate,
    hours: input.hours,
    workCategory: input.workCategory,
    billable: input.billable,
    notes: input.notes,
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

export class JsonTimeEntryRepository implements TimeEntryRepository {
  constructor(
    private readonly filePath: string,
    private readonly dataKey: string = "timeEntries"
  ) {}

  async getAll(): Promise<TimeEntry[]> {
    return readJsonCollection<TimeEntry>(this.filePath, this.dataKey);
  }

  private async saveAll(entries: TimeEntry[]) {
    await writeJsonCollection(this.filePath, this.dataKey, entries);
  }

  async query(filters: TimeEntryFilters): Promise<PaginatedTimeEntries> {
    const entries = await this.getAll();
    const filtered = sortTimeEntries(
      entries.filter((entry) => matchesTimeEntryFilters(entry, filters)),
      filters.sortBy,
      filters.sortDirection
    );
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const start = (page - 1) * pageSize;

    return {
      data: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize))
    };
  }

  async getById(id: string): Promise<TimeEntry | null> {
    const entries = await this.getAll();
    return entries.find((entry) => entry.id === id) ?? null;
  }

  async create(input: TimeEntryInput): Promise<TimeEntry> {
    const entries = await this.getAll();
    const created = mapCreatedEntry(input);
    entries.push(created);
    await this.saveAll(entries);
    return created;
  }

  async update(id: string, input: Partial<TimeEntryInput>): Promise<TimeEntry | null> {
    const entries = await this.getAll();
    const index = entries.findIndex((entry) => entry.id === id);
    if (index === -1) {
      return null;
    }
    entries[index] = {
      ...entries[index],
      ...input,
      updatedAt: new Date().toISOString()
    };
    await this.saveAll(entries);
    return entries[index];
  }

  async delete(id: string): Promise<boolean> {
    const entries = await this.getAll();
    const next = entries.filter((entry) => entry.id !== id);
    if (next.length === entries.length) {
      return false;
    }
    await this.saveAll(next);
    return true;
  }
}
