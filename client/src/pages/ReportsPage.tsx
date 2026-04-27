import { api } from "../lib/api";

export function ReportsPage() {
  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Reports and export</h3>
            <p>Download the workforce directory and exception reports in CSV format.</p>
          </div>
        </div>
        <div className="report-grid">
          <a className="report-card" href={api.exportUrl("/export/employees")}>
            <strong>All employees</strong>
            <span>Complete directory export</span>
          </a>
          <a className="report-card" href={api.exportUrl("/export/data-quality")}>
            <strong>Data quality issues</strong>
            <span>Warning and validation report</span>
          </a>
          <a className="report-card" href={api.exportUrl("/export/supervisor-report")}>
            <strong>Supervisor team report</strong>
            <span>Grouped direct report counts</span>
          </a>
          <a className="report-card" href={api.exportUrl("/export/employees", { region: "North America" })}>
            <strong>Filtered example</strong>
            <span>Demonstrates filtered exports via query params</span>
          </a>
        </div>
      </section>
    </div>
  );
}
