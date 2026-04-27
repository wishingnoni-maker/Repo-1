import XLSX from "xlsx";
import { z } from "zod";
import type { EmployeeRepository } from "../repositories/EmployeeRepository.js";
import type { ImportSummary } from "../types.js";
import {
  employeeInputSchema,
  findMissingFields,
  mapExcelRowToEmployeeInput
} from "../utils/employee.js";

export const importEmployeesFromWorkbook = async (
  fileBuffer: Buffer,
  fileName: string,
  repository: EmployeeRepository,
  updateExisting: boolean
): Promise<ImportSummary> => {
  type EmployeeImportInput = z.infer<typeof employeeInputSchema>;
  const lowerFileName = fileName.toLowerCase();
  const isCsv = lowerFileName.endsWith(".csv");
  const isExcel = lowerFileName.endsWith(".xlsx") || lowerFileName.endsWith(".xls");

  if (!isCsv && !isExcel) {
    throw new Error("Unsupported file type. Please upload .xlsx, .xls, or .csv.");
  }

  const workbook = XLSX.read(fileBuffer, {
    type: "buffer"
  });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });

  const validRows: Array<{ rowNumber: number; data: EmployeeImportInput }> = [];
  const duplicateEmails: string[] = [];
  const missingRequiredFields: Array<{ rowNumber: number; fields: string[] }> = [];
  const results: ImportSummary["results"] = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const mapped = mapExcelRowToEmployeeInput(row);
    const missing = findMissingFields(mapped);

    if (missing.length) {
      missingRequiredFields.push({ rowNumber, fields: missing });
      results.push({ rowNumber, status: "skipped", reason: `missing_${missing.join("_")}` });
      continue;
    }

    const parsed = employeeInputSchema.safeParse(mapped);
    if (!parsed.success) {
      results.push({
        rowNumber,
        status: "skipped",
        email: mapped.email,
        reason: parsed.error.issues.map((issue) => issue.message).join(", ")
      });
      continue;
    }

    const existing = await repository.getByEmail(parsed.data.email);
    if (existing && !updateExisting) {
      duplicateEmails.push(parsed.data.email);
    }

    validRows.push({ rowNumber, data: parsed.data });
  }

  const upsertResults = await repository.upsertMany(
    validRows.map((row) => row.data),
    updateExisting ? "upsert" : "insert-only"
  );
  upsertResults.forEach((result, index) => {
    results.push({
      rowNumber: validRows[index]?.rowNumber ?? index + 2,
      status: result.status,
      email: result.employee.email,
      reason: result.reason
    });
  });

  return {
    totalRows: rows.length,
    successfullyImported: upsertResults.filter((result) => result.status === "imported").length,
    updatedRecords: upsertResults.filter((result) => result.status === "updated").length,
    skippedRows:
      results.filter((result) => result.status === "skipped").length,
    duplicateEmails,
    missingRequiredFields,
    results
  };
};
