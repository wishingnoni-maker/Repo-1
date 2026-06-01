import { Router } from "express";
import { z } from "zod";
import { TimesheetService } from "../services/timesheetService.js";

const dayHoursSchema = z.object({
  mon: z.number().min(0).max(24).default(0),
  tue: z.number().min(0).max(24).default(0),
  wed: z.number().min(0).max(24).default(0),
  thu: z.number().min(0).max(24).default(0),
  fri: z.number().min(0).max(24).default(0),
  sat: z.number().min(0).max(24).default(0),
  sun: z.number().min(0).max(24).default(0)
});

const rowSchema = z.object({
  rowGroupId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid("Project is required"),
  workCategory: z.string().min(1, "Work category is required"),
  billable: z.boolean().default(true),
  notes: z.string().max(1000).default(""),
  holidayOrWeekendReason: z.string().max(1000).default(""),
  hours: dayHoursSchema
});

const saveWeekSchema = z.object({
  employeeId: z.string().uuid("Employee is required"),
  weekStart: z.string().min(1, "Week start is required"),
  status: z.enum(["draft", "submitted"]).default("draft"),
  showWeekend: z.boolean().default(false),
  rows: z.array(rowSchema).default([])
});

const parseBoolean = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return String(value).trim().toLowerCase() === "true";
};

const parseNumber = (value: unknown, defaultValue: number) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const normalizeHours = (hours: Record<string, unknown>) => ({
  mon: parseNumber(hours.mon, 0),
  tue: parseNumber(hours.tue, 0),
  wed: parseNumber(hours.wed, 0),
  thu: parseNumber(hours.thu, 0),
  fri: parseNumber(hours.fri, 0),
  sat: parseNumber(hours.sat, 0),
  sun: parseNumber(hours.sun, 0)
});

const normalizeSaveWeekBody = (body: Record<string, unknown>) => ({
  employeeId: String(body.employeeId ?? "").trim(),
  weekStart: String(body.weekStart ?? "").trim(),
  status: body.status === "submitted" ? "submitted" : "draft",
  showWeekend: parseBoolean(body.showWeekend) ?? false,
  rows: Array.isArray(body.rows)
    ? body.rows.map((row) => {
        const value = row as Record<string, unknown>;
        return {
          rowGroupId: value.rowGroupId ? String(value.rowGroupId).trim() : null,
          clientId: value.clientId ? String(value.clientId).trim() : null,
          projectId: String(value.projectId ?? "").trim(),
          workCategory: String(value.workCategory ?? "").trim(),
          billable: parseBoolean(value.billable) ?? true,
          notes: String(value.notes ?? ""),
          holidayOrWeekendReason: String(value.holidayOrWeekendReason ?? ""),
          hours: normalizeHours((value.hours as Record<string, unknown>) ?? {})
        };
      })
    : []
});

export const createTimesheetsRouter = (service: TimesheetService) => {
  const router = Router();

  router.get("/week", async (req, res) => {
    try {
      const employeeId = String(req.query.employeeId ?? "").trim();
      const weekStart = String(req.query.weekStart ?? "").trim();
      if (!employeeId || !weekStart) {
        return res.status(400).json({ message: "employeeId and weekStart are required." });
      }
      return res.json(await service.getWeek(employeeId, weekStart));
    } catch (caught) {
      return res.status(400).json({ message: caught instanceof Error ? caught.message : "Failed to load week." });
    }
  });

  router.post("/week/save", async (req, res) => {
    const parsed = saveWeekSchema.safeParse(normalizeSaveWeekBody(req.body));
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues });
    }
    try {
      return res.json(await service.saveWeek(parsed.data));
    } catch (caught) {
      return res.status(400).json({ message: caught instanceof Error ? caught.message : "Failed to save timesheet." });
    }
  });

  router.post("/week/submit", async (req, res) => {
    try {
      const employeeId = String(req.body.employeeId ?? "").trim();
      const weekStart = String(req.body.weekStart ?? "").trim();
      if (!employeeId || !weekStart) {
        return res.status(400).json({ message: "employeeId and weekStart are required." });
      }
      return res.json(await service.submitWeek(employeeId, weekStart));
    } catch (caught) {
      return res.status(400).json({ message: caught instanceof Error ? caught.message : "Failed to submit timesheet." });
    }
  });

  router.post("/week/copy-previous", async (req, res) => {
    try {
      const employeeId = String(req.body.employeeId ?? "").trim();
      const targetWeekStart = String(req.body.targetWeekStart ?? "").trim();
      if (!employeeId || !targetWeekStart) {
        return res.status(400).json({ message: "employeeId and targetWeekStart are required." });
      }
      return res.json(await service.copyPreviousWeek(employeeId, targetWeekStart));
    } catch (caught) {
      return res.status(400).json({ message: caught instanceof Error ? caught.message : "Failed to copy previous week." });
    }
  });

  router.get("/", async (req, res) => {
    return res.json(
      await service.list({
        employeeId: req.query.employeeId as string | undefined,
        clientId: req.query.clientId as string | undefined,
        projectId: req.query.projectId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        status: req.query.status as string | undefined,
        billable: parseBoolean(req.query.billable),
        search: req.query.search as string | undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 25
      })
    );
  });

  router.get("/options/employees", async (_req, res) => {
    res.json(await service.getEmployeeOptions());
  });

  router.get("/options/clients", async (_req, res) => {
    res.json(await service.getClientOptions());
  });

  router.get("/options/projects", async (req, res) => {
    res.json(
      await service.getProjectOptions({
        clientId: req.query.clientId as string | undefined,
        search: req.query.search as string | undefined,
        recentOnly: req.query.recentOnly === undefined ? true : parseBoolean(req.query.recentOnly) !== false
      })
    );
  });

  router.get("/export", async (req, res) => {
    try {
      const employeeId = String(req.query.employeeId ?? "").trim();
      const weekStart = String(req.query.weekStart ?? "").trim();
      if (!employeeId || !weekStart) {
        return res.status(400).json({ message: "employeeId and weekStart are required." });
      }
      res.header("Content-Type", "text/csv");
      res.attachment("weekly-timesheet.csv");
      return res.send(await service.exportWeek(employeeId, weekStart));
    } catch (caught) {
      return res.status(400).json({ message: caught instanceof Error ? caught.message : "Failed to export timesheet." });
    }
  });

  return router;
};
