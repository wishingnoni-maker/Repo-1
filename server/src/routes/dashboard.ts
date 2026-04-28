import { Router } from "express";
import type { EmployeeRepository } from "../repositories/EmployeeRepository.js";
import { ClientService } from "../services/clientService.js";
import { buildDashboardSummary } from "../services/dashboardService.js";
import { ProjectService } from "../services/projectService.js";

export const createDashboardRouter = (
  employeeRepository: EmployeeRepository,
  clientService: ClientService,
  projectService: ProjectService
) => {
  const router = Router();

  router.get("/summary", async (_req, res) => {
    const [employees, clients, projects] = await Promise.all([
      employeeRepository.getAll(),
      clientService.getAll(),
      projectService.getAll()
    ]);
    res.json(buildDashboardSummary(employees, clients, projects));
  });

  return router;
};
