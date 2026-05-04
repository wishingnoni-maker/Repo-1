import type {
  ImportSummary,
  PaginatedProjects,
  Project,
  ProjectFilters,
  ProjectInput,
  ProjectSummary
} from "../types.js";
import { groupCounts } from "../utils/employee.js";
import { createProjectRepository } from "../repositories/index.js";
import {
  findMissingProjectFields,
  mapRowToProjectInput,
  normalizeProjectInput,
  projectInputSchema
} from "../utils/project.js";
import { normalizeValue } from "../utils/text.js";
import { readRowsFromWorkbook } from "./importService.js";
import type { ProjectRepository } from "../repositories/ProjectRepository.js";

const projectKey = (value: string) => normalizeValue(value).toLowerCase();

const numeric = (value: number | null) => value ?? 0;

export class ProjectService {
  constructor(private readonly repository: ProjectRepository = createProjectRepository()) {}

  async getAll(): Promise<Project[]> {
    return this.repository.getAll();
  }

  async saveAll(projects: Project[]): Promise<void> {
    await this.repository.saveAll(projects);
  }

  async query(filters: ProjectFilters): Promise<PaginatedProjects> {
    return this.repository.query(filters);
  }

  async getById(id: string): Promise<Project | null> {
    return this.repository.getById(id);
  }

  async getByName(name: string): Promise<Project | null> {
    return this.repository.getByName(name);
  }

  async create(input: ProjectInput): Promise<Project> {
    return this.repository.create(input);
  }

  async update(id: string, input: Partial<ProjectInput>): Promise<Project | null> {
    return this.repository.update(id, input);
  }

  async delete(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  async importFromWorkbook(
    fileBuffer: Buffer,
    fileName: string,
    mode: "replace" | "upsert"
  ): Promise<ImportSummary> {
    const rows = readRowsFromWorkbook(fileBuffer, fileName);
    const validRows: Array<{ rowNumber: number; data: ProjectInput }> = [];
    const duplicateRows: string[] = [];
    const errors: string[] = [];
    const missingRequiredFields: ImportSummary["missingRequiredFields"] = [];
    const results: ImportSummary["results"] = [];

    const existing = mode === "replace" ? [] : await this.getAll();
    const existingByName = new Map(existing.map((project) => [projectKey(project.projectName), project]));

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const mapped = mapRowToProjectInput(row);
      const missing = findMissingProjectFields(mapped);

      if (missing.length) {
        missingRequiredFields.push({ rowNumber, fields: missing });
        results.push({ rowNumber, status: "skipped", key: mapped.projectName, reason: "missing_required_fields" });
        continue;
      }

      const parsed = projectInputSchema.safeParse(mapped);
      if (!parsed.success) {
        const reason = parsed.error.issues.map((issue) => issue.message).join(", ");
        errors.push(`Row ${rowNumber}: ${reason}`);
        results.push({ rowNumber, status: "skipped", key: mapped.projectName, reason });
        continue;
      }

      const key = projectKey(parsed.data.projectName);
      const known = existingByName.get(key);
      if (known && mode !== "replace") {
        duplicateRows.push(parsed.data.projectName);
      }
      validRows.push({ rowNumber, data: parsed.data });
    }

    const nextProjects = mode === "replace" ? [] : [...existing];
    const nextByName = new Map(nextProjects.map((project) => [projectKey(project.projectName), project]));
    let importedRows = 0;
    let updatedRows = 0;

    validRows.forEach(({ rowNumber, data }) => {
      const key = projectKey(data.projectName);
      const current = nextByName.get(key);
      if (!current) {
        const timestamp = new Date().toISOString();
        const created: Project = {
          id: crypto.randomUUID(),
          ...data,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        nextProjects.push(created);
        nextByName.set(key, created);
        importedRows += 1;
        results.push({ rowNumber, status: "imported", key: data.projectName });
        return;
      }

      const updated: Project = {
        ...current,
        ...normalizeProjectInput(data),
        updatedAt: new Date().toISOString()
      };
      const index = nextProjects.findIndex((project) => project.id === current.id);
      nextProjects[index] = updated;
      nextByName.set(key, updated);
      updatedRows += 1;
      results.push({ rowNumber, status: "updated", key: data.projectName });
    });

    await this.saveAll(nextProjects);

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

  buildSummary(projects: Project[]): ProjectSummary {
    const withResources = projects.filter((project) => project.numberOfResources !== null);
    const withWorkWeeks = projects.filter((project) => project.numberOfWorkWeeks !== null);

    return {
      totalProjects: projects.length,
      activeProjects: projects.filter((project) => project.projectStatus.toLowerCase() === "active").length,
      completedProjects: projects.filter((project) => project.projectStatus.toLowerCase() === "completed").length,
      projectsMissingManager: projects.filter((project) => !project.projectManager).length,
      projectsMissingManagerEmail: projects.filter((project) => !project.projectManagerEmail).length,
      projectsMissingPoNumber: projects.filter((project) => !project.poNumber).length,
      totalEstimatedHours: projects.reduce((sum, project) => sum + numeric(project.projectEstimatedHrs), 0),
      totalBudgetHours: projects.reduce((sum, project) => sum + numeric(project.budgetHours), 0),
      totalBudgetCost: projects.reduce((sum, project) => sum + numeric(project.budgetCost), 0),
      totalExpenseBudget: projects.reduce((sum, project) => sum + numeric(project.expenseBudgetProjectCurrency), 0),
      averageNumberOfResources: withResources.length
        ? Number((withResources.reduce((sum, project) => sum + numeric(project.numberOfResources), 0) / withResources.length).toFixed(1))
        : 0,
      averageNumberOfWorkWeeks: withWorkWeeks.length
        ? Number((withWorkWeeks.reduce((sum, project) => sum + numeric(project.numberOfWorkWeeks), 0) / withWorkWeeks.length).toFixed(1))
        : 0
    };
  }

  buildChartData(projects: Project[]) {
    return {
      byStatus: groupCounts(projects.map((project) => project.projectStatus)),
      byRegion: groupCounts(projects.map((project) => project.projectRegion)),
      byManager: groupCounts(projects.map((project) => project.projectManager)),
      bySoldBy: groupCounts(projects.map((project) => project.projectSoldBy)),
      byCurrency: groupCounts(projects.map((project) => project.projectCurrency))
    };
  }
}
