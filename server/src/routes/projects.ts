import { Router } from "express";
import { projectInputSchema, normalizeProjectInput } from "../utils/project.js";
import { ProjectService } from "../services/projectService.js";

export const createProjectRouter = (projectService: ProjectService) => {
  const router = Router();

  router.get("/", async (req, res) => {
    const result = await projectService.query({
      search: req.query.search as string | undefined,
      manager: req.query.manager as string | undefined,
      managerEmail: req.query.managerEmail as string | undefined,
      poNumber: req.query.poNumber as string | undefined,
      soldBy: req.query.soldBy as string | undefined,
      projectStatus: req.query.projectStatus as string | undefined,
      projectRegion: req.query.projectRegion as string | undefined,
      projectCurrency: req.query.projectCurrency as string | undefined,
      missingPoNumber: req.query.missingPoNumber === "true",
      missingManager: req.query.missingManager === "true",
      missingManagerEmail: req.query.missingManagerEmail === "true",
      missingStartDate: req.query.missingStartDate === "true",
      missingEndDate: req.query.missingEndDate === "true",
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 25
    });
    res.json(result);
  });

  router.get("/summary/cards", async (_req, res) => {
    const projects = await projectService.getAll();
    res.json(projectService.buildSummary(projects));
  });

  router.get("/quality/issues", async (_req, res) => {
    const projects = await projectService.getAll();
    const { buildProjectDataQualityIssues } = await import("../services/dataQualityService.js");
    res.json(buildProjectDataQualityIssues(projects));
  });

  router.get("/:id", async (req, res) => {
    const project = await projectService.getById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }
    res.json({ project });
  });

  router.post("/", async (req, res) => {
    const parsed = projectInputSchema.safeParse(normalizeProjectInput(req.body));
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues });
    }
    const existing = await projectService.getByName(parsed.data.projectName);
    if (existing) {
      return res.status(409).json({ message: "Project name already exists." });
    }
    res.status(201).json(await projectService.create(parsed.data));
  });

  router.put("/:id", async (req, res) => {
    const parsed = projectInputSchema.partial().safeParse(normalizeProjectInput(req.body));
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues });
    }
    const updated = await projectService.update(req.params.id, parsed.data);
    if (!updated) {
      return res.status(404).json({ message: "Project not found." });
    }
    res.json(updated);
  });

  router.delete("/:id", async (req, res) => {
    const deleted = await projectService.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Project not found." });
    }
    res.status(204).send();
  });

  return router;
};
