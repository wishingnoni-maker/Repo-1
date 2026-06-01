import { Router } from "express";
import { z } from "zod";
import { ProjectAssignmentService } from "../services/projectAssignmentService.js";

const nullableNumber = z.number().nullable().default(null);
const nullableDate = z.string().nullable().default(null);

const assignmentSchema = z.object({
  projectId: z.string().uuid("Project is required"),
  employeeId: z.string().uuid("Employee is required"),
  roleOnProject: z.string().default(""),
  plannedHours: nullableNumber,
  billRate: nullableNumber,
  costRate: nullableNumber,
  allocationPercent: nullableNumber,
  startDate: nullableDate,
  endDate: nullableDate,
  active: z.boolean().default(true)
});

const bulkAssignmentSchema = z.object({
  projectId: z.string().uuid("Project is required"),
  employeeIds: z.array(z.string().uuid("Employee is required")).min(1, "Select at least one employee"),
  roleOnProject: z.string().default(""),
  plannedHours: nullableNumber,
  billRate: nullableNumber,
  costRate: nullableNumber,
  allocationPercent: nullableNumber,
  startDate: nullableDate,
  endDate: nullableDate,
  active: z.boolean().default(true)
});

const parseNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const parseFlag = (value: unknown, defaultValue = true) => {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return String(value).trim().toLowerCase() === "true";
};

const normalizeInput = (body: Record<string, unknown>) => ({
  projectId: String(body.projectId ?? "").trim(),
  employeeId: String(body.employeeId ?? "").trim(),
  roleOnProject: String(body.roleOnProject ?? "").trim(),
  plannedHours: parseNumber(body.plannedHours),
  billRate: parseNumber(body.billRate),
  costRate: parseNumber(body.costRate),
  allocationPercent: parseNumber(body.allocationPercent),
  startDate: body.startDate ? String(body.startDate).trim() : null,
  endDate: body.endDate ? String(body.endDate).trim() : null,
  active: parseFlag(body.active)
});

const normalizePartialInput = (body: Record<string, unknown>) => {
  const normalized: Record<string, unknown> = {};
  for (const key of ["projectId", "employeeId", "roleOnProject", "startDate", "endDate"] as const) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      normalized[key] = body[key];
    }
  }
  for (const key of ["plannedHours", "billRate", "costRate", "allocationPercent"] as const) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      normalized[key] = parseNumber(body[key]);
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "active")) {
    normalized.active = parseFlag(body.active);
  }

  if (normalized.projectId !== undefined) normalized.projectId = String(normalized.projectId ?? "").trim();
  if (normalized.employeeId !== undefined) normalized.employeeId = String(normalized.employeeId ?? "").trim();
  if (normalized.roleOnProject !== undefined) normalized.roleOnProject = String(normalized.roleOnProject ?? "").trim();
  if (normalized.startDate !== undefined) normalized.startDate = normalized.startDate ? String(normalized.startDate).trim() : null;
  if (normalized.endDate !== undefined) normalized.endDate = normalized.endDate ? String(normalized.endDate).trim() : null;

  return normalized;
};

const normalizeBulkInput = (body: Record<string, unknown>) => ({
  projectId: String(body.projectId ?? "").trim(),
  employeeIds: Array.isArray(body.employeeIds)
    ? body.employeeIds.map((employeeId) => String(employeeId ?? "").trim()).filter(Boolean)
    : [],
  roleOnProject: String(body.roleOnProject ?? "").trim(),
  plannedHours: parseNumber(body.plannedHours),
  billRate: parseNumber(body.billRate),
  costRate: parseNumber(body.costRate),
  allocationPercent: parseNumber(body.allocationPercent),
  startDate: body.startDate ? String(body.startDate).trim() : null,
  endDate: body.endDate ? String(body.endDate).trim() : null,
  active: parseFlag(body.active)
});

export const createProjectAssignmentsRouter = (service: ProjectAssignmentService) => {
  const router = Router();

  router.get("/", async (req, res) => {
    if (typeof req.query.projectId === "string" && req.query.projectId) {
      return res.json(await service.getByProjectId(req.query.projectId));
    }
    return res.json(await service.getAll());
  });

  router.post("/", async (req, res) => {
    const parsed = assignmentSchema.safeParse(normalizeInput(req.body));
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues });
    }
    try {
      return res.status(201).json(await service.create(parsed.data));
    } catch (caught) {
      return res.status(400).json({ message: caught instanceof Error ? caught.message : "Failed to create assignment." });
    }
  });

  router.post("/bulk", async (req, res) => {
    const parsed = bulkAssignmentSchema.safeParse(normalizeBulkInput(req.body));
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues });
    }
    try {
      return res.status(201).json(await service.createMany(parsed.data));
    } catch (caught) {
      return res.status(400).json({ message: caught instanceof Error ? caught.message : "Failed to create assignments." });
    }
  });

  router.put("/:id", async (req, res) => {
    const parsed = assignmentSchema.partial().safeParse(normalizePartialInput(req.body));
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues });
    }
    try {
      const updated = await service.update(String(req.params.id), parsed.data);
      if (!updated) {
        return res.status(404).json({ message: "Assignment not found." });
      }
      return res.json(updated);
    } catch (caught) {
      return res.status(400).json({ message: caught instanceof Error ? caught.message : "Failed to update assignment." });
    }
  });

  router.delete("/:id", async (req, res) => {
    const updated = await service.deactivate(String(req.params.id));
    if (!updated) {
      return res.status(404).json({ message: "Assignment not found." });
    }
    res.status(204).send();
  });

  return router;
};
