import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { DataQualityIssue } from "../types";

export function DataQualityPage() {
  const [issues, setIssues] = useState<DataQualityIssue[]>([]);

  useEffect(() => {
    api.getDataQuality().then(setIssues).catch(console.error);
  }, []);

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Data quality checks</h3>
            <p>Operational warnings and cleanup items detected from employee records.</p>
          </div>
          <a className="button button--primary" href={api.exportUrl("/export/data-quality")}>
            Export issues CSV
          </a>
        </div>
        <div className="issue-list">
          {issues.map((issue, index) => (
            <article className="issue-card" key={`${issue.type}-${index}`}>
              <span className={`badge ${issue.severity === "error" ? "badge--error" : "badge--warn"}`}>{issue.severity}</span>
              <strong>{issue.employeeName || issue.type}</strong>
              <p>{issue.message}</p>
              {issue.email ? <small>{issue.email}</small> : null}
            </article>
          ))}
          {!issues.length ? <div className="empty-state">No issues detected.</div> : null}
        </div>
      </section>
    </div>
  );
}
