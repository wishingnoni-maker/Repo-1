import { Router } from "express";
import { TimeTrackingService } from "../services/timeTrackingService.js";

export const createTimeTrackingRouter = (service: TimeTrackingService) => {
  const router = Router();

  router.get("/dashboard", async (_req, res) => {
    res.json(await service.getDashboard());
  });

  router.get("/projects", async (req, res) => {
    res.json(
      await service.getProjectRows({
        clientId: req.query.clientId as string | undefined,
        projectManager: req.query.projectManager as string | undefined,
        status: req.query.status as string | undefined,
        profitabilityStatus: req.query.profitabilityStatus as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        lastFiveYearsOnly:
          req.query.lastFiveYearsOnly === undefined ? true : req.query.lastFiveYearsOnly === "true",
        search: req.query.search as string | undefined
      })
    );
  });

  router.get("/projects/:projectId", async (req, res) => {
    const detail = await service.getProjectDetail(String(req.params.projectId));
    if (!detail) {
      return res.status(404).json({ message: "Project tracking profile not found." });
    }
    return res.json(detail);
  });

  router.get("/project-options", async (_req, res) => {
    res.json(await service.getProjectOptions());
  });

  router.get("/employee-options", async (_req, res) => {
    res.json(await service.getEmployeeOptions());
  });

  router.get("/export/time-entries", async (_req, res) => {
    res.header("Content-Type", "text/csv");
    res.attachment("time-tracking-time-entries.csv");
    res.send(await service.exportTimeEntries());
  });

  router.get("/export/project-profitability", async (_req, res) => {
    res.header("Content-Type", "text/csv");
    res.attachment("time-tracking-project-profitability.csv");
    res.send(await service.exportProjectProfitability());
  });

  return router;
};
