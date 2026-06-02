import { api } from "../lib/api";
import { PageHeader } from "../components/PageHeader";

export function ReportsPage() {
  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Workforce operations"
        title="Reports / Export"
        subtitle="Export workforce, client, project, and timesheet data."
      />
      <section className="panel">
        <div className="report-grid">
          <a className="report-card" href={api.exportUrl("/export/employees")}><strong>All employees</strong><span>Complete workforce directory export</span></a>
          <a className="report-card" href={api.exportUrl("/export/clients")}><strong>All clients</strong><span>Client directory export</span></a>
          <a className="report-card" href={api.exportUrl("/export/projects")}><strong>All projects</strong><span>Project portfolio export</span></a>
          <a className="report-card" href={api.exportUrl("/export/project-financials")}><strong>Project financials</strong><span>Hours, budget, cost, expense, PO, region, sold-by</span></a>
          <a className="report-card" href={api.exportUrl("/export/data-quality")}><strong>Employee data quality</strong><span>Employee warning and validation report</span></a>
          <a className="report-card" href={api.exportUrl("/export/client-data-quality")}><strong>Client data quality</strong><span>Missing client fields and duplicates</span></a>
          <a className="report-card" href={api.exportUrl("/export/project-data-quality")}><strong>Project data quality</strong><span>Missing and invalid project field report</span></a>
          <a className="report-card" href={api.exportUrl("/export/supervisor-report")}><strong>Supervisor team report</strong><span>Grouped direct report counts</span></a>
        </div>
      </section>
    </div>
  );
}
