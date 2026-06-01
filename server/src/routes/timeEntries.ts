import { Router } from "express";
import { TimeEntryService } from "../services/timeEntryService.js";
import {
  normalizePartialTimeEntryInput,
  normalizeTimeEntryInput,
  timeEntryInputSchema
} from "../utils/timeEntry.js";

const parseBoolean = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return String(value).toLowerCase() === "true";
};

export const createTimeEntryRouter = (timeEntryService: TimeEntryService) => {
  const router = Router();

  router.get("/", async (req, res) => {
    res.json(
      await timeEntryService.query({
        employeeId: req.query.employeeId as string | undefined,
        clientId: req.query.clientId as string | undefined,
        projectId: req.query.projectId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        billable: parseBoolean(req.query.billable),
        workCategory: req.query.workCategory as string | undefined,
        approvalStatus: req.query.approvalStatus as string | undefined,
        search: req.query.search as string | undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 25,
        sortBy: (req.query.sortBy as any) ?? "workDate",
        sortDirection: (req.query.sortDirection as any) ?? "desc"
      })
    );
  });

  router.get("/summary", async (req, res) => {
    res.json(
      await timeEntryService.getSummary({
        employeeId: req.query.employeeId as string | undefined,
        clientId: req.query.clientId as string | undefined,
        projectId: req.query.projectId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        billable: parseBoolean(req.query.billable),
        workCategory: req.query.workCategory as string | undefined,
        approvalStatus: req.query.approvalStatus as string | undefined,
        search: req.query.search as string | undefined,
        sortBy: (req.query.sortBy as any) ?? "workDate",
        sortDirection: (req.query.sortDirection as any) ?? "desc"
      })
    );
  });

  router.get("/project-options", async (_req, res) => {
    res.json(await timeEntryService.getEligibleProjectOptions());
  });

  router.get("/employee-options", async (_req, res) => {
    res.json(await timeEntryService.getEmployeeOptions());
  });

  router.get("/export", async (req, res) => {
    const csv = await timeEntryService.exportCsv({
      employeeId: req.query.employeeId as string | undefined,
      clientId: req.query.clientId as string | undefined,
      projectId: req.query.projectId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      billable: parseBoolean(req.query.billable),
      workCategory: req.query.workCategory as string | undefined,
      approvalStatus: req.query.approvalStatus as string | undefined,
      search: req.query.search as string | undefined,
      sortBy: (req.query.sortBy as any) ?? "workDate",
      sortDirection: (req.query.sortDirection as any) ?? "desc"
    });
    res.header("Content-Type", "text/csv");
    res.attachment("time-entries.csv");
    res.send(csv);
  });

  router.get("/:id", async (req, res) => {
    const entry = await timeEntryService.getById(String(req.params.id));
    if (!entry) {
      return res.status(404).json({ message: "Time entry not found." });
    }
    res.json({ timeEntry: entry });
  });

  router.post("/", async (req, res) => {
    const parsed = timeEntryInputSchema.safeParse(normalizeTimeEntryInput(req.body));
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues });
    }

    try {
      const created = await timeEntryService.create(parsed.data);
      res.status(201).json(created);
    } catch (caught) {
      res.status(400).json({ message: caught instanceof Error ? caught.message : "Failed to create time entry." });
    }
  });

  router.put("/:id", async (req, res) => {
    const parsed = timeEntryInputSchema.partial().safeParse(normalizePartialTimeEntryInput(req.body));
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues });
    }

    try {
      const updated = await timeEntryService.update(String(req.params.id), parsed.data);
      if (!updated) {
        return res.status(404).json({ message: "Time entry not found." });
      }
      res.json(updated);
    } catch (caught) {
      res.status(400).json({ message: caught instanceof Error ? caught.message : "Failed to update time entry." });
    }
  });

  router.delete("/:id", async (req, res) => {
    const deleted = await timeEntryService.delete(String(req.params.id));
    if (!deleted) {
      return res.status(404).json({ message: "Time entry not found." });
    }
    res.status(204).send();
  });

  return router;
};
