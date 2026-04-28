import { useMemo, useState } from "react";
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

const importOptions = [
  { key: "employees", label: "Employees" },
  { key: "clients", label: "Clients" },
  { key: "projects", label: "Projects" }
] as const;

type ImportType = (typeof importOptions)[number]["key"];

interface ImportPageProps {
  onImportSuccess: () => void;
}

export function ImportPage({ onImportSuccess }: ImportPageProps) {
  const [importType, setImportType] = useState<ImportType>("employees");
  const [file, setFile] = useState<File | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const copy = useMemo(() => {
    if (importType === "clients") {
      return {
        title: "Import client file",
        helper: "Accepted formats: Excel workbook (.xlsx, .xls) or CSV (.csv). PDF is not supported.",
        modeLabel: "Replace existing clients instead of update/add"
      };
    }
    if (importType === "projects") {
      return {
        title: "Import project file",
        helper: "Accepted formats: Excel workbook (.xlsx, .xls) or CSV (.csv). PDF is not supported.",
        modeLabel: "Replace existing projects instead of update/add"
      };
    }
    return {
      title: "Import employee file",
      helper: "Accepted formats: Excel workbook (.xlsx, .xls) or CSV (.csv). PDF is not supported.",
      modeLabel: "Employees keep the current update/add import behavior"
    };
  }, [importType]);

  const runImport = async () => {
    if (!file) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result =
        importType === "employees"
          ? await api.importEmployees(file)
          : importType === "clients"
            ? await api.importClients(file, replaceExisting)
            : await api.importProjects(file, replaceExisting);
      setSummary(result);
      onImportSuccess();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>{copy.title}</h3>
            <p>Import Workforce Hub data modules without changing the working employee, client, or project dashboards.</p>
            <p>{copy.helper}</p>
          </div>
        </div>
        <div className="tabbar">
          {importOptions.map((option) => (
            <button
              key={option.key}
              className={`tabbar__item${importType === option.key ? " tabbar__item--active" : ""}`}
              onClick={() => {
                setImportType(option.key);
                setFile(null);
                setSummary(null);
                setError("");
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label>
            <span>{importType === "employees" ? "Employee file" : importType === "clients" ? "Client file" : "Project file"}</span>
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
          {importType !== "employees" ? (
            <label className="toggle">
              <input checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} type="checkbox" />
              <span>{copy.modeLabel}</span>
            </label>
          ) : (
            <div className="hint-box">{copy.modeLabel}</div>
          )}
          <button className="button button--primary" disabled={!file || loading} onClick={runImport} type="button">
            {loading ? "Importing..." : `Import ${importType}`}
          </button>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </section>

      {summary ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h3>Import summary</h3>
              <p>Imported, updated, skipped, duplicate, and validation details for the selected module.</p>
            </div>
          </div>
          <div className="summary-grid">
            <div><span>Total rows</span><strong>{summary.totalRows}</strong></div>
            <div><span>Imported rows</span><strong>{summary.importedRows}</strong></div>
            <div><span>Updated rows</span><strong>{summary.updatedRows}</strong></div>
            <div><span>Skipped rows</span><strong>{summary.skippedRows}</strong></div>
          </div>
          <div className="stack-list-wrapper">
            <h4>Duplicate rows</h4>
            <ul className="stack-list">
              {summary.duplicateRows.map((value) => <li key={value}>{value}</li>)}
              {!summary.duplicateRows.length ? <li>No duplicate rows detected.</li> : null}
            </ul>
          </div>
          <div className="stack-list-wrapper">
            <h4>Errors</h4>
            <ul className="stack-list">
              {summary.errors.map((value) => <li key={value}>{value}</li>)}
              {!summary.errors.length ? <li>No import errors reported.</li> : null}
            </ul>
          </div>
          <div className="stack-list-wrapper">
            <h4>Missing required fields</h4>
            <ul className="stack-list">
              {summary.missingRequiredFields.map((issue) => (
                <li key={issue.rowNumber}>Row {issue.rowNumber}: {issue.fields.join(", ")}</li>
              ))}
              {!summary.missingRequiredFields.length ? <li>No required-field gaps detected.</li> : null}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}
