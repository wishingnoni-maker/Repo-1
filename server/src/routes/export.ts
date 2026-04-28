import { Router } from "express";
import type { EmployeeRepository } from "../repositories/EmployeeRepository.js";
import { ClientService } from "../services/clientService.js";
import {
  buildClientDataQualityIssues,
  buildEmployeeDataQualityIssues,
  buildProjectDataQualityIssues
} from "../services/dataQualityService.js";
import {
  clientsToCsv,
  employeesToCsv,
  issuesToCsv,
  projectFinancialsToCsv,
  projectsToCsv,
  supervisorTeamsToCsv
} from "../services/exportService.js";
import { ProjectService } from "../services/projectService.js";
import { normalizeSupervisorKey } from "../utils/employee.js";

export const createExportRouter = (
  employeeRepository: EmployeeRepository,
  clientService: ClientService,
  projectService: ProjectService
) => {
  const router = Router();

  router.get("/employees", async (req, res) => {
    const queryResult = await employeeRepository.query({
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

  router.get("/clients", async (_req, res) => {
    res.header("Content-Type", "text/csv");
    res.attachment("clients.csv");
    res.send(clientsToCsv(await clientService.getAll()));
  });

  router.get("/projects", async (_req, res) => {
    res.header("Content-Type", "text/csv");
    res.attachment("projects.csv");
    res.send(projectsToCsv(await projectService.getAll()));
  });

  router.get("/project-financials", async (_req, res) => {
    res.header("Content-Type", "text/csv");
    res.attachment("project-financials.csv");
    res.send(projectFinancialsToCsv(await projectService.getAll()));
  });

  router.get("/data-quality", async (_req, res) => {
    const employees = await employeeRepository.getAll();
    res.header("Content-Type", "text/csv");
    res.attachment("employee-data-quality.csv");
    res.send(issuesToCsv(buildEmployeeDataQualityIssues(employees)));
  });

  router.get("/client-data-quality", async (_req, res) => {
    const clients = await clientService.getAll();
    res.header("Content-Type", "text/csv");
    res.attachment("client-data-quality.csv");
    res.send(issuesToCsv(buildClientDataQualityIssues(clients)));
  });

  router.get("/project-data-quality", async (_req, res) => {
    const projects = await projectService.getAll();
    res.header("Content-Type", "text/csv");
    res.attachment("project-data-quality.csv");
    res.send(issuesToCsv(buildProjectDataQualityIssues(projects)));
  });

  router.get("/supervisor-report", async (_req, res) => {
    const employees = await employeeRepository.getAll();
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
