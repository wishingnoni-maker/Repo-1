import { Router } from "express";
import type { EmployeeRepository } from "../repositories/EmployeeRepository.js";
import { buildDashboardSummary } from "../services/dashboardService.js";

export const createDashboardRouter = (repository: EmployeeRepository) => {
  const router = Router();

  router.get("/summary", async (_req, res) => {
    const employees = await repository.getAll();
    res.json(buildDashboardSummary(employees));
  });

  return router;
};
