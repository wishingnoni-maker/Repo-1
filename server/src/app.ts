import cors from "cors";
import express from "express";
import {
  createClientRepository,
  createEmployeeRepository,
  createProjectRepository
} from "./repositories/index.js";
import { createClientRouter } from "./routes/clients.js";
import { createDashboardRouter } from "./routes/dashboard.js";
import { createDataQualityRouter } from "./routes/dataQuality.js";
import { createEmployeeRouter } from "./routes/employees.js";
import { createExportRouter } from "./routes/export.js";
import { createImportRouter } from "./routes/import.js";
import { createOrgRouter } from "./routes/org.js";
import { createProjectRouter } from "./routes/projects.js";
import { createSystemRouter } from "./routes/system.js";
import { ClientService } from "./services/clientService.js";
import { ProjectService } from "./services/projectService.js";

export const createApp = () => {
  const app = express();
  const repository = createEmployeeRepository();
  const clientService = new ClientService(createClientRepository());
  const projectService = new ProjectService(createProjectRepository());
  const allowedOrigins = [
    "http://localhost:5173",
    "https://kind-plant-0b9c4f610.7.azurestaticapps.net",
    ...(process.env.CLIENT_URL?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [])
  ];

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("CORS origin not allowed."));
      }
    })
  );
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/import", createImportRouter(repository, clientService, projectService));
  app.use("/api/employees", createEmployeeRouter(repository));
  app.use("/api/clients", createClientRouter(clientService, projectService));
  app.use("/api/projects", createProjectRouter(projectService));
  app.use("/api/dashboard", createDashboardRouter(repository, clientService, projectService));
  app.use("/api/org", createOrgRouter(repository));
  app.use("/api/data-quality", createDataQualityRouter(repository, clientService, projectService));
  app.use("/api/export", createExportRouter(repository, clientService, projectService));
  app.use("/api/system", createSystemRouter(repository, clientService, projectService));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    res.status(500).json({ message: "Unexpected server error." });
  });

  return app;
};
