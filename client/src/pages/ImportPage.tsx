import { useState } from "react";
import { api } from "../lib/api";
import type { ImportSummary } from "../types";

const acceptedFileTypes = [
  ".xlsx",
  ".xls",
  ".csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv"
].join(",");

const isSupportedFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv");
};

interface ImportPageProps {
  adminKey: string;
  onImportSuccess: () => void;
}

export function ImportPage({ adminKey, onImportSuccess }: ImportPageProps) {
  const [file, setFile] = useState<File | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Import Excel employee file</h3>
            <p>Upload the first worksheet and map common employee directory headers automatically.</p>
            <p>Accepted formats: Excel workbook (.xlsx, .xls) or CSV (.csv). PDF is not supported.</p>
          </div>
        </div>
        <div className="form-grid">
          <label>
            <span>Employee file</span>
            <input
              accept={acceptedFileTypes}
              onChange={(event) => {
                const selectedFile = event.target.files?.[0] ?? null;
                setSummary(null);

                if (!selectedFile) {
                  setFile(null);
                  setError("");
                  return;
                }

                if (!isSupportedFile(selectedFile)) {
                  setFile(null);
                  setError("Unsupported file type. Please upload .xlsx, .xls, or .csv.");
                  event.target.value = "";
                  return;
                }

                setError("");
                setFile(selectedFile);
              }}
              type="file"
            />
          </label>
          <label className="toggle">
            <input checked={updateExisting} onChange={(event) => setUpdateExisting(event.target.checked)} type="checkbox" />
            <span>Update existing employees when emails match</span>
          </label>
          <button
            className="button button--primary"
            disabled={!file || loading}
            onClick={async () => {
              try {
                setLoading(true);
                setError("");
                const result = await api.importEmployees(file as File, updateExisting, adminKey);
                setSummary(result);
                onImportSuccess();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Import failed.");
              } finally {
                setLoading(false);
              }
            }}
            type="button"
          >
            {loading ? "Importing..." : "Start import"}
          </button>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </section>

      {summary ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h3>Import summary</h3>
              <p>Row-level validation and duplicate handling results.</p>
            </div>
          </div>
          <div className="summary-grid">
            <div><span>Total rows</span><strong>{summary.totalRows}</strong></div>
            <div><span>Imported</span><strong>{summary.successfullyImported}</strong></div>
            <div><span>Updated</span><strong>{summary.updatedRecords}</strong></div>
            <div><span>Skipped</span><strong>{summary.skippedRows}</strong></div>
          </div>
          <div className="stack-list-wrapper">
            <h4>Duplicate emails</h4>
            <ul className="stack-list">
              {summary.duplicateEmails.map((email) => (
                <li key={email}>{email}</li>
              ))}
              {!summary.duplicateEmails.length ? <li>No duplicate emails detected in insert-only mode.</li> : null}
            </ul>
          </div>
          <div className="stack-list-wrapper">
            <h4>Missing required fields</h4>
            <ul className="stack-list">
              {summary.missingRequiredFields.map((issue) => (
                <li key={issue.rowNumber}>
                  Row {issue.rowNumber}: {issue.fields.join(", ")}
                </li>
              ))}
              {!summary.missingRequiredFields.length ? <li>No required-field gaps detected.</li> : null}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}
