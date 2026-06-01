import type { ProjectAssignment, ProjectAssignmentInput } from "../types.js";

export interface ProjectAssignmentRepository {
  getAll(): Promise<ProjectAssignment[]>;
  getById(id: string): Promise<ProjectAssignment | null>;
  getByProjectId(projectId: string): Promise<ProjectAssignment[]>;
  create(input: ProjectAssignmentInput): Promise<ProjectAssignment>;
  update(id: string, input: Partial<ProjectAssignmentInput>): Promise<ProjectAssignment | null>;
  deactivate(id: string): Promise<ProjectAssignment | null>;
}
