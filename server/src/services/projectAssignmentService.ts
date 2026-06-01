import {
  createEmployeeRepository,
  createProjectAssignmentRepository,
  createProjectRepository
} from "../repositories/index.js";
import type { EmployeeRepository } from "../repositories/EmployeeRepository.js";
import type { ProjectAssignmentRepository } from "../repositories/ProjectAssignmentRepository.js";
import type { ProjectRepository } from "../repositories/ProjectRepository.js";
import type { ProjectAssignment, ProjectAssignmentBulkInput, ProjectAssignmentInput } from "../types.js";

const validateDateRange = (startDate: string | null, endDate: string | null) => {
  if (startDate && endDate && startDate > endDate) {
    throw new Error("Assignment start date must be before or equal to end date.");
  }
};

const validateNonNegative = (value: number | null, label: string) => {
  if (value != null && value < 0) {
    throw new Error(`${label} must be zero or greater.`);
  }
};

export class ProjectAssignmentService {
  constructor(
    private readonly repository: ProjectAssignmentRepository = createProjectAssignmentRepository(),
    private readonly projectRepository: ProjectRepository = createProjectRepository(),
    private readonly employeeRepository: EmployeeRepository = createEmployeeRepository()
  ) {}

  async getAll(): Promise<ProjectAssignment[]> {
    return this.enrichAssignments(await this.repository.getAll());
  }

  async getByProjectId(projectId: string): Promise<ProjectAssignment[]> {
    return this.enrichAssignments(await this.repository.getByProjectId(projectId));
  }

  async create(input: ProjectAssignmentInput): Promise<ProjectAssignment> {
    await this.validateInput(input);
    await this.ensureNoDuplicateActiveAssignment(input);
    const created = await this.repository.create(input);
    return this.enrichAssignment(created);
  }

  async createMany(input: ProjectAssignmentBulkInput): Promise<ProjectAssignment[]> {
    const employeeIds = Array.from(new Set(input.employeeIds.map((employeeId) => employeeId.trim()).filter(Boolean)));
    if (!employeeIds.length) {
      throw new Error("Select at least one employee to assign.");
    }

    const rows: ProjectAssignmentInput[] = employeeIds.map((employeeId) => ({
      projectId: input.projectId,
      employeeId,
      roleOnProject: input.roleOnProject,
      plannedHours: input.plannedHours,
      billRate: input.billRate,
      costRate: input.costRate,
      allocationPercent: input.allocationPercent,
      startDate: input.startDate,
      endDate: input.endDate,
      active: input.active
    }));

    await Promise.all(rows.map((row) => this.validateInput(row)));
    await Promise.all(rows.map((row) => this.ensureNoDuplicateActiveAssignment(row)));

    const created: ProjectAssignment[] = [];
    for (const row of rows) {
      created.push(await this.repository.create(row));
    }
    return this.enrichAssignments(created);
  }

  async update(id: string, input: Partial<ProjectAssignmentInput>): Promise<ProjectAssignment | null> {
    const existing = await this.repository.getById(id);
    if (!existing) {
      return null;
    }

    const merged: ProjectAssignmentInput = {
      projectId: input.projectId ?? existing.projectId,
      employeeId: input.employeeId ?? existing.employeeId,
      roleOnProject: input.roleOnProject ?? existing.roleOnProject,
      plannedHours: input.plannedHours !== undefined ? input.plannedHours : existing.plannedHours,
      billRate: input.billRate !== undefined ? input.billRate : existing.billRate,
      costRate: input.costRate !== undefined ? input.costRate : existing.costRate,
      allocationPercent:
        input.allocationPercent !== undefined ? input.allocationPercent : existing.allocationPercent,
      startDate: input.startDate !== undefined ? input.startDate : existing.startDate,
      endDate: input.endDate !== undefined ? input.endDate : existing.endDate,
      active: input.active ?? existing.active
    };

    await this.validateInput(merged);
    await this.ensureNoDuplicateActiveAssignment(merged, id);
    const updated = await this.repository.update(id, input);
    return updated ? this.enrichAssignment(updated) : null;
  }

  async deactivate(id: string): Promise<ProjectAssignment | null> {
    const updated = await this.repository.deactivate(id);
    return updated ? this.enrichAssignment(updated) : null;
  }

  private async validateInput(input: ProjectAssignmentInput) {
    const [project, employee] = await Promise.all([
      this.projectRepository.getById(input.projectId),
      this.employeeRepository.getById(input.employeeId)
    ]);

    if (!project) {
      throw new Error("Selected project was not found.");
    }
    if (!employee) {
      throw new Error("Selected employee was not found.");
    }

    validateNonNegative(input.plannedHours, "Planned hours");
    validateNonNegative(input.billRate, "Bill rate");
    validateNonNegative(input.costRate, "Cost rate");

    if (input.allocationPercent != null && (input.allocationPercent < 0 || input.allocationPercent > 100)) {
      throw new Error("Allocation percent must be between 0 and 100.");
    }

    validateDateRange(input.startDate, input.endDate);
  }

  private async ensureNoDuplicateActiveAssignment(input: ProjectAssignmentInput, currentId?: string) {
    if (!input.active) {
      return;
    }
    const assignments = await this.repository.getByProjectId(input.projectId);
    const duplicate = assignments.find(
      (assignment) =>
        assignment.active &&
        assignment.employeeId === input.employeeId &&
        assignment.id !== currentId
    );

    if (duplicate) {
      throw new Error("This employee is already actively assigned to the selected project.");
    }
  }

  private async enrichAssignments(assignments: ProjectAssignment[]) {
    return Promise.all(assignments.map((assignment) => this.enrichAssignment(assignment)));
  }

  private async enrichAssignment(assignment: ProjectAssignment) {
    if (
      assignment.employeeName &&
      assignment.employeeEmail &&
      assignment.employeeTitle !== undefined &&
      assignment.employeeRegion !== undefined
    ) {
      return assignment;
    }

    const employee = await this.employeeRepository.getById(assignment.employeeId);
    if (!employee) {
      return assignment;
    }

    return {
      ...assignment,
      employeeName: employee.fullName,
      employeeEmail: employee.email,
      employeeTitle: employee.title,
      employeeRegion: employee.employeeRegion
    };
  }
}
