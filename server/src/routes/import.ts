import { Router } from "express";
import multer from "multer";
import type { EmployeeRepository } from "../repositories/EmployeeRepository.js";
import { requireAdminKey } from "../middleware/admin.js";
import { importEmployeesFromWorkbook } from "../services/importService.js";

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

export const createImportRouter = (repository: EmployeeRepository) => {
  const router = Router();

  router.post("/employees", requireAdminKey, (req, res) => {
    upload.single("file")(req, res, async (error) => {
      if (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected server error.";
        const status = message === "Unsupported file type. Please upload .xlsx, .xls, or .csv." ? 400 : 500;
        res.status(status).json({ message });
        return;
      }

      if (!req.file) {
        res.status(400).json({ message: "Excel file is required." });
        return;
      }

      if (!hasSupportedExtension(req.file.originalname)) {
        res.status(400).json({ message: "Unsupported file type. Please upload .xlsx, .xls, or .csv." });
        return;
      }

      const updateExisting = String(req.body.updateExisting ?? "false") === "true";
      try {
        const summary = await importEmployeesFromWorkbook(
          req.file.buffer,
          req.file.originalname,
          repository,
          updateExisting
        );
        res.json(summary);
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "Unexpected server error.";
        const status = message === "Unsupported file type. Please upload .xlsx, .xls, or .csv." ? 400 : 500;
        res.status(status).json({ message });
      }
    });
  });

  return router;
};
