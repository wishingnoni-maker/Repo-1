import type {
  PaginatedProjects,
  Project,
  ProjectFilters,
  ProjectInput
} from "../types.js";

export interface ProjectRepository {
  getAll(): Promise<Project[]>;
  saveAll(projects: Project[]): Promise<void>;
  query(filters: ProjectFilters): Promise<PaginatedProjects>;
  getById(id: string): Promise<Project | null>;
  getByName(name: string): Promise<Project | null>;
  create(input: ProjectInput): Promise<Project>;
  update(id: string, input: Partial<ProjectInput>): Promise<Project | null>;
  delete(id: string): Promise<boolean>;
}
