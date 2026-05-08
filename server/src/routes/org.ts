import { Router } from "express";
import type { EmployeeRepository } from "../repositories/EmployeeRepository.js";
import { normalizeSupervisorKey } from "../utils/employee.js";

export const createOrgRouter = (repository: EmployeeRepository) => {
  const router = Router();

  const handler = async (req: import("express").Request, res: import("express").Response) => {
    const employees = await repository.getAll();
    const region = req.query.region as string | undefined;
    const country = req.query.country as string | undefined;
    const filtered = employees.filter((employee) => {
      if (region && employee.employeeRegion !== region) {
        return false;
      }
      if (country && employee.country !== country) {
        return false;
      }
      return true;
    });

    const employeeNames = new Set(filtered.map((employee) => normalizeSupervisorKey(employee.fullName)));
    const groups = Array.from(
      filtered.reduce((map, employee) => {
        const supervisorName = employee.supervisorName || "Unassigned Supervisor";
        const key = normalizeSupervisorKey(supervisorName);
        const existing = map.get(key) ?? {
          supervisorName,
          teamSize: 0,
          region: employee.employeeRegion,
          country: employee.country,
          supervisorExists: employeeNames.has(key),
          reports: [] as typeof filtered
        };

        existing.teamSize += 1;
        existing.reports.push(employee);
        existing.supervisorExists = employeeNames.has(key);
        map.set(key, existing);
        return map;
      }, new Map<string, { supervisorName: string; teamSize: number; region: string; country: string; supervisorExists: boolean; reports: typeof filtered }>())
      .values()
    ).sort((a, b) => b.teamSize - a.teamSize || a.supervisorName.localeCompare(b.supervisorName));

    res.json(groups);
  };

  router.get("/", handler);
  router.get("/supervisors", handler);

  return router;
};
