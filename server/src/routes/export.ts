import { Router } from "express";
import type { EmployeeRepository } from "../repositories/EmployeeRepository.js";
import { buildDataQualityIssues } from "../services/dataQualityService.js";
import { employeesToCsv, issuesToCsv, supervisorTeamsToCsv } from "../services/exportService.js";
import { normalizeSupervisorKey } from "../utils/employee.js";

export const createExportRouter = (repository: EmployeeRepository) => {
  const router = Router();

  router.get("/employees", async (req, res) => {
    const queryResult = await repository.query({
      search: req.query.search as string | undefined,
      region: req.query.region as string | undefined,
      country: req.query.country as string | undefined,
      title: req.query.title as string | undefined,
      supervisor: req.query.supervisor as string | undefined,
      titleCode: req.query.titleCode as string | undefined,
      hireYear: req.query.hireYear as string | undefined,
      page: 1,
      pageSize: Number.MAX_SAFE_INTEGER,
      sortBy: (req.query.sortBy as any) ?? "name",
      sortDirection: (req.query.sortDirection as any) ?? "asc"
    });
    res.header("Content-Type", "text/csv");
    res.attachment("employees.csv");
    res.send(employeesToCsv(queryResult.data));
  });

  router.get("/data-quality", async (_req, res) => {
    const employees = await repository.getAll();
    res.header("Content-Type", "text/csv");
    res.attachment("data-quality.csv");
    res.send(issuesToCsv(buildDataQualityIssues(employees)));
  });

  router.get("/supervisor-report", async (_req, res) => {
    const employees = await repository.getAll();
    const report = Array.from(
      employees.reduce((map, employee) => {
        if (!employee.supervisorName) {
          return map;
        }
        const key = normalizeSupervisorKey(employee.supervisorName);
        const current = map.get(key) ?? {
          supervisorName: employee.supervisorName,
          teamSize: 0,
          region: employee.employeeRegion,
          country: employee.country
        };
        current.teamSize += 1;
        map.set(key, current);
        return map;
      }, new Map<string, { supervisorName: string; teamSize: number; region: string; country: string }>())
      .values()
    );
    res.header("Content-Type", "text/csv");
    res.attachment("supervisor-report.csv");
    res.send(supervisorTeamsToCsv(report));
  });

  return router;
};
