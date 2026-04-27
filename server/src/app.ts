import cors from "cors";
import express from "express";
import { createEmployeeRepository } from "./repositories/index.js";
import { createDashboardRouter } from "./routes/dashboard.js";
import { createDataQualityRouter } from "./routes/dataQuality.js";
import { createEmployeeRouter } from "./routes/employees.js";
import { createExportRouter } from "./routes/export.js";
import { createImportRouter } from "./routes/import.js";
import { createOrgRouter } from "./routes/org.js";

export const createApp = () => {
  const app = express();
  const repository = createEmployeeRepository();

  app.use(
    cors({
      origin: process.env.CLIENT_URL?.split(",") ?? "*"
    })
  );
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/import", createImportRouter(repository));
  app.use("/api/employees", createEmployeeRouter(repository));
  app.use("/api/dashboard", createDashboardRouter(repository));
  app.use("/api/org", createOrgRouter(repository));
  app.use("/api/data-quality", createDataQualityRouter(repository));
  app.use("/api/export", createExportRouter(repository));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    res.status(500).json({ message: "Unexpected server error." });
  });

  return app;
};
