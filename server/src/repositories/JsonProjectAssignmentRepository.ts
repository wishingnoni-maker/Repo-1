import type { ProjectAssignment, ProjectAssignmentInput } from "../types.js";
import { readJsonCollection, writeJsonCollection } from "../services/jsonStore.js";
import type { ProjectAssignmentRepository } from "./ProjectAssignmentRepository.js";

const createRecord = (input: ProjectAssignmentInput): ProjectAssignment => {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    employeeId: input.employeeId,
    employeeName: "",
    employeeEmail: "",
    employeeTitle: "",
    employeeRegion: "",
    roleOnProject: input.roleOnProject,
    plannedHours: input.plannedHours,
    billRate: input.billRate,
    costRate: input.costRate,
    allocationPercent: input.allocationPercent,
    startDate: input.startDate,
    endDate: input.endDate,
    active: input.active,
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

export class JsonProjectAssignmentRepository implements ProjectAssignmentRepository {
  constructor(
    private readonly filePath: string,
    private readonly dataKey: string = "projectAssignments"
  ) {}

  async getAll(): Promise<ProjectAssignment[]> {
    return readJsonCollection<ProjectAssignment>(this.filePath, this.dataKey);
  }

  private async saveAll(assignments: ProjectAssignment[]) {
    await writeJsonCollection(this.filePath, this.dataKey, assignments);
  }

  async getById(id: string): Promise<ProjectAssignment | null> {
    const assignments = await this.getAll();
    return assignments.find((assignment) => assignment.id === id) ?? null;
  }

  async getByProjectId(projectId: string): Promise<ProjectAssignment[]> {
    const assignments = await this.getAll();
    return assignments.filter((assignment) => assignment.projectId === projectId);
  }

  async create(input: ProjectAssignmentInput): Promise<ProjectAssignment> {
    const assignments = await this.getAll();
    const created = createRecord(input);
    assignments.push(created);
    await this.saveAll(assignments);
    return created;
  }

  async update(id: string, input: Partial<ProjectAssignmentInput>): Promise<ProjectAssignment | null> {
    const assignments = await this.getAll();
    const index = assignments.findIndex((assignment) => assignment.id === id);
    if (index === -1) {
      return null;
    }

    assignments[index] = {
      ...assignments[index],
      ...input,
      updatedAt: new Date().toISOString()
    };

    await this.saveAll(assignments);
    return assignments[index];
  }

  async deactivate(id: string): Promise<ProjectAssignment | null> {
    return this.update(id, { active: false });
  }
}
