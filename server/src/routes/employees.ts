import { Router } from "express";
import { z } from "zod";
import type { EmployeeRepository } from "../repositories/EmployeeRepository.js";
import { employeeInputSchema, normalizeEmployeeInput } from "../utils/employee.js";

export const createEmployeeRouter = (repository: EmployeeRepository) => {
  const router = Router();

  router.get("/", async (req, res) => {
    const result = await repository.query({
      search: req.query.search as string | undefined,
      region: req.query.region as string | undefined,
      country: req.query.country as string | undefined,
      title: req.query.title as string | undefined,
      supervisor: req.query.supervisor as string | undefined,
      titleCode: req.query.titleCode as string | undefined,
      hireYear: req.query.hireYear as string | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 10,
      sortBy: (req.query.sortBy as
        | "name"
        | "hireDate"
        | "region"
        | "title"
        | "tenure"
        | undefined) ?? "name",
      sortDirection: (req.query.sortDirection as "asc" | "desc" | undefined) ?? "asc"
    });

    res.json(result);
  });

  router.get("/:id", async (req, res) => {
    const employee = await repository.getById(String(req.params.id));
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    const all = await repository.getAll();
    const directReports = all.filter(
      (candidate) => candidate.supervisorName.toLowerCase() === employee.fullName.toLowerCase()
    );
    const relatedEmployees = all
      .filter(
        (candidate) =>
          candidate.id !== employee.id &&
          (candidate.employeeRegion === employee.employeeRegion || candidate.titleCode === employee.titleCode)
      )
      .slice(0, 10);

    const supervisor = all.find(
      (candidate) => candidate.fullName.toLowerCase() === employee.supervisorName.toLowerCase()
    );

    res.json({ employee, supervisor: supervisor ?? null, directReports, relatedEmployees });
  });

  router.post("/", async (req, res) => {
    const normalized = normalizeEmployeeInput(req.body);
    const parsed = employeeInputSchema.safeParse(normalized);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues });
    }

    const existing = await repository.getByEmail(parsed.data.email);
    if (existing) {
      return res.status(409).json({ message: "Employee email already exists." });
    }

    const created = await repository.create(parsed.data);
    res.status(201).json(created);
  });

  router.put("/:id", async (req, res) => {
    const normalized = normalizeEmployeeInput(req.body);
    const parsed = employeeInputSchema.partial().safeParse(normalized);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues });
    }

    const updated = await repository.update(String(req.params.id), parsed.data);
    if (!updated) {
      return res.status(404).json({ message: "Employee not found." });
    }

    res.json(updated);
  });

  router.delete("/:id", async (req, res) => {
    const deleted = await repository.delete(String(req.params.id));
    if (!deleted) {
      return res.status(404).json({ message: "Employee not found." });
    }
    res.status(204).send();
  });

  router.post("/bulk-delete", async (req, res) => {
    const payload = z.object({ ids: z.array(z.string()).min(1) }).safeParse(req.body);
    if (!payload.success) {
      return res.status(400).json({ message: payload.error.issues });
    }
    const deletedCount = await repository.bulkDelete(payload.data.ids);
    res.json({ deletedCount });
  });

  router.post("/bulk-update", async (req, res) => {
    const payload = z
      .object({
        ids: z.array(z.string()).min(1),
        updates: z
          .object({
            employeeRegion: z.string().optional(),
            supervisorName: z.string().optional(),
            country: z.string().optional(),
            title: z.string().optional()
          })
          .refine((value) => Object.keys(value).length > 0, "At least one update field is required")
      })
      .safeParse(req.body);

    if (!payload.success) {
      return res.status(400).json({ message: payload.error.issues });
    }

    const updatedCount = await repository.bulkUpdate(payload.data);
    res.json({ updatedCount });
  });

  return router;
};
