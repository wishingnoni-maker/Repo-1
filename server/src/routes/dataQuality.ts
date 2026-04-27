import { Router } from "express";
import type { EmployeeRepository } from "../repositories/EmployeeRepository.js";
import { buildDataQualityIssues } from "../services/dataQualityService.js";

export const createDataQualityRouter = (repository: EmployeeRepository) => {
  const router = Router();

  router.get("/", async (_req, res) => {
    const employees = await repository.getAll();
    res.json(buildDataQualityIssues(employees));
  });

  return router;
};
