import { Router } from "express";
import type { ProjectService } from "../services/projectService.js";
import { ClientService } from "../services/clientService.js";
import { clientInputSchema, normalizeClientInput } from "../utils/client.js";
import { slugifyName } from "../utils/text.js";

export const createClientRouter = (clientService: ClientService, projectService: ProjectService) => {
  const router = Router();

  router.get("/", async (req, res) => {
    const result = await clientService.query({
      search: req.query.search as string | undefined,
      clientStatus: req.query.clientStatus as string | undefined,
      clientInvoiceCurrency: req.query.clientInvoiceCurrency as string | undefined,
      clientManager: req.query.clientManager as string | undefined,
      missingContact: req.query.missingContact === "true",
      missingDescription: req.query.missingDescription === "true",
      missingManager: req.query.missingManager === "true",
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 10
    });
    res.json(result);
  });

  router.get("/summary/cards", async (_req, res) => {
    const clients = await clientService.getAll();
    res.json(clientService.buildSummary(clients));
  });

  router.get("/quality/issues", async (_req, res) => {
    const clients = await clientService.getAll();
    const { buildClientDataQualityIssues } = await import("../services/dataQualityService.js");
    res.json(buildClientDataQualityIssues(clients));
  });

  router.get("/:id", async (req, res) => {
    const client = await clientService.getById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: "Client not found." });
    }
    const projects = await projectService.getAll();
    const relatedProjects = projects.filter((project) =>
      slugifyName(project.projectName).includes(slugifyName(client.clientName))
    );
    res.json({ client, relatedProjects });
  });

  router.post("/", async (req, res) => {
    const parsed = clientInputSchema.safeParse(normalizeClientInput(req.body));
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues });
    }
    const existing = await clientService.getByName(parsed.data.clientName);
    if (existing) {
      return res.status(409).json({ message: "Client name already exists." });
    }
    res.status(201).json(await clientService.create(parsed.data));
  });

  router.put("/:id", async (req, res) => {
    const parsed = clientInputSchema.partial().safeParse(normalizeClientInput(req.body));
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues });
    }
    const updated = await clientService.update(req.params.id, parsed.data);
    if (!updated) {
      return res.status(404).json({ message: "Client not found." });
    }
    res.json(updated);
  });

  router.delete("/:id", async (req, res) => {
    const deleted = await clientService.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Client not found." });
    }
    res.status(204).send();
  });

  return router;
};
