import { Router } from "express";
import type { EmployeeRepository } from "../repositories/EmployeeRepository.js";
import { ClientService } from "../services/clientService.js";
import {
  buildClientDataQualityIssues,
  buildEmployeeDataQualityIssues,
  buildProjectDataQualityIssues
} from "../services/dataQualityService.js";
import { ProjectService } from "../services/projectService.js";

export const createDataQualityRouter = (
  employeeRepository: EmployeeRepository,
  clientService: ClientService,
  projectService: ProjectService
) => {
  const router = Router();

  router.get("/", async (_req, res) => {
    const [employees, clients, projects] = await Promise.all([
      employeeRepository.getAll(),
      clientService.getAll(),
      projectService.getAll()
    ]);
    res.json({
      employees: buildEmployeeDataQualityIssues(employees),
      clients: buildClientDataQualityIssues(clients),
      projects: buildProjectDataQualityIssues(projects)
    });
  });

  return router;
};
