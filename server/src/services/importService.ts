import XLSX from "xlsx";
import { z } from "zod";
import type { EmployeeRepository } from "../repositories/EmployeeRepository.js";
import type { ImportSummary } from "../types.js";
import {
  employeeInputSchema,
  findMissingFields,
  mapExcelRowToEmployeeInput
} from "../utils/employee.js";

export const readRowsFromWorkbook = (
  fileBuffer: Buffer,
  fileName: string
): Record<string, unknown>[] => {
  const lowerFileName = fileName.toLowerCase();
  const isCsv = lowerFileName.endsWith(".csv");
  const isExcel = lowerFileName.endsWith(".xlsx") || lowerFileName.endsWith(".xls");

  if (!isCsv && !isExcel) {
    throw new Error("Unsupported file type. Please upload .xlsx, .xls, or .csv.");
  }

  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
};

export const importEmployeesFromWorkbook = async (
  fileBuffer: Buffer,
  fileName: string,
  repository: EmployeeRepository,
  updateExisting: boolean
): Promise<ImportSummary> => {
  type EmployeeImportInput = z.infer<typeof employeeInputSchema>;
  const rows = readRowsFromWorkbook(fileBuffer, fileName);
  const validRows: Array<{ rowNumber: number; data: EmployeeImportInput }> = [];
  const duplicateRows: string[] = [];
  const errors: string[] = [];
  const missingRequiredFields: Array<{ rowNumber: number; fields: string[] }> = [];
  const results: ImportSummary["results"] = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const mapped = mapExcelRowToEmployeeInput(row);
    const missing = findMissingFields(mapped);

    if (missing.length) {
      missingRequiredFields.push({ rowNumber, fields: missing });
      results.push({ rowNumber, status: "skipped", key: mapped.email, reason: `missing_${missing.join("_")}` });
      continue;
    }

    const parsed = employeeInputSchema.safeParse(mapped);
    if (!parsed.success) {
      const reason = parsed.error.issues.map((issue) => issue.message).join(", ");
      errors.push(`Row ${rowNumber}: ${reason}`);
      results.push({
        rowNumber,
        status: "skipped",
        key: mapped.email,
        reason
      });
      continue;
    }

    const existing = await repository.getByEmail(parsed.data.email);
    if (existing && !updateExisting) {
      duplicateRows.push(parsed.data.email);
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
      key: result.employee.email,
      reason: result.reason
    });
  });

  return {
    totalRows: rows.length,
    importedRows: upsertResults.filter((result) => result.status === "imported").length,
    updatedRows: upsertResults.filter((result) => result.status === "updated").length,
    skippedRows: results.filter((result) => result.status === "skipped").length,
    duplicateRows,
    errors,
    missingRequiredFields,
    results
  };
};
