import { Router } from "express";
import multer from "multer";
import type { EmployeeRepository } from "../repositories/EmployeeRepository.js";
import { ClientService } from "../services/clientService.js";
import { importEmployeesFromWorkbook } from "../services/importService.js";
import { ProjectService } from "../services/projectService.js";

const supportedMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "application/octet-stream"
]);

const hasSupportedExtension = (fileName: string) => {
  const lowerName = fileName.toLowerCase();
  return lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv");
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    if (hasSupportedExtension(file.originalname) && supportedMimeTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error("Unsupported file type. Please upload .xlsx, .xls, or .csv."));
  }
});

const importRouteHandler =
  (
    importer: (
      fileBuffer: Buffer,
      fileName: string,
      mode: "replace" | "upsert"
    ) => Promise<unknown>
  ) =>
  (req: import("express").Request, res: import("express").Response) => {
    upload.single("file")(req, res, async (error) => {
      if (error) {
        const message = error instanceof Error ? error.message : "Unexpected server error.";
        const status = message === "Unsupported file type. Please upload .xlsx, .xls, or .csv." ? 400 : 500;
        res.status(status).json({ message });
        return;
      }
      if (!req.file) {
        res.status(400).json({ message: "Import file is required." });
        return;
      }
      if (!hasSupportedExtension(req.file.originalname)) {
        res.status(400).json({ message: "Unsupported file type. Please upload .xlsx, .xls, or .csv." });
        return;
      }

      const mode = String(req.body.replaceExisting ?? "false") === "true" ? "replace" : "upsert";
      try {
        res.json(await importer(req.file.buffer, req.file.originalname, mode));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Unexpected server error.";
        const status = message === "Unsupported file type. Please upload .xlsx, .xls, or .csv." ? 400 : 500;
        res.status(status).json({ message });
      }
    });
  };

export const createImportRouter = (
  employeeRepository: EmployeeRepository,
  clientService: ClientService,
  projectService: ProjectService
) => {
  const router = Router();

  router.post(
    "/employees",
    importRouteHandler(async (fileBuffer, fileName, mode) =>
      importEmployeesFromWorkbook(fileBuffer, fileName, employeeRepository, mode === "upsert")
    )
  );
  router.post(
    "/clients",
    importRouteHandler(async (fileBuffer, fileName, mode) =>
      clientService.importFromWorkbook(fileBuffer, fileName, mode)
    )
  );
  router.post(
    "/projects",
    importRouteHandler(async (fileBuffer, fileName, mode) =>
      projectService.importFromWorkbook(fileBuffer, fileName, mode)
    )
  );

  return router;
};
