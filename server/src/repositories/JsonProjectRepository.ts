import type {
  PaginatedProjects,
  Project,
  ProjectFilters,
  ProjectInput
} from "../types.js";
import {
  createProjectRecord,
  matchesProjectFilters,
  mergeProjectRecord
} from "../utils/project.js";
import { normalizeValue } from "../utils/text.js";
import { readJsonCollection, writeJsonCollection } from "../services/jsonStore.js";
import type { ProjectRepository } from "./ProjectRepository.js";

const projectKey = (value: string) => normalizeValue(value).toLowerCase();

const sortProjects = (projects: Project[]) =>
  [...projects].sort((a, b) => a.projectName.localeCompare(b.projectName));

export class JsonProjectRepository implements ProjectRepository {
  constructor(
    private readonly filePath: string,
    private readonly dataKey: string = "projects"
  ) {}

  async getAll(): Promise<Project[]> {
    return readJsonCollection<Project>(this.filePath, this.dataKey);
  }

  async saveAll(projects: Project[]): Promise<void> {
    await writeJsonCollection(this.filePath, this.dataKey, projects);
  }

  async query(filters: ProjectFilters): Promise<PaginatedProjects> {
    const projects = await this.getAll();
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const filtered = sortProjects(projects.filter((project) => matchesProjectFilters(project, filters)));
    const start = (page - 1) * pageSize;

    return {
      data: filtered.slice(start, start + pageSize),
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize))
    };
  }

  async getById(id: string): Promise<Project | null> {
    const projects = await this.getAll();
    return projects.find((project) => project.id === id) ?? null;
  }

  async getByName(name: string): Promise<Project | null> {
    const projects = await this.getAll();
    return projects.find((project) => projectKey(project.projectName) === projectKey(name)) ?? null;
  }

  async create(input: ProjectInput): Promise<Project> {
    const projects = await this.getAll();
    const created = createProjectRecord(input);
    projects.push(created);
    await this.saveAll(projects);
    return created;
  }

  async update(id: string, input: Partial<ProjectInput>): Promise<Project | null> {
    const projects = await this.getAll();
    const index = projects.findIndex((project) => project.id === id);
    if (index === -1) {
      return null;
    }
    projects[index] = mergeProjectRecord(projects[index], input);
    await this.saveAll(projects);
    return projects[index];
  }

  async delete(id: string): Promise<boolean> {
    const projects = await this.getAll();
    const next = projects.filter((project) => project.id !== id);
    if (next.length === projects.length) {
      return false;
    }
    await this.saveAll(next);
    return true;
  }
}
