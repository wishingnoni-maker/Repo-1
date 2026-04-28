import { api } from "../lib/api";
import { formatDate, getTenureLabel } from "../lib/format";
import { isMissing, safeString } from "../lib/safe";
import type { EmployeeDetailResponse } from "../types";

interface EmployeeDrawerProps {
  detail: EmployeeDetailResponse | null;
  onClose: () => void;
}

export function EmployeeDrawer({ detail, onClose }: EmployeeDrawerProps) {
  if (!detail) {
    return null;
  }

  const { employee, supervisor, directReports, relatedEmployees } = detail;
  const renderValue = (value: unknown) =>
    isMissing(value) ? <span className="missing-badge">Missing</span> : <strong>{safeString(value)}</strong>;

  return (
    <aside className="drawer">
      <div className="drawer__header">
        <div>
          <p className="page-kicker">Employee profile</p>
          <h3>{employee.fullName}</h3>
          <p>{employee.title || "Title missing"}</p>
        </div>
        <button className="button" onClick={onClose} type="button">
          Close
        </button>
      </div>

      <div className="profile-card">
        <div>
          <span>Email</span>
          {renderValue(employee.email)}
        </div>
        <div>
          <span>Cell</span>
          {renderValue(employee.employeeCell)}
        </div>
        <div>
          <span>Country</span>
          {renderValue(employee.country)}
        </div>
        <div>
          <span>Region</span>
          {renderValue(employee.employeeRegion)}
        </div>
        <div>
          <span>Supervisor</span>
          {renderValue(supervisor?.fullName || employee.supervisorName)}
        </div>
        <div>
          <span>Hire / Tenure</span>
          <strong>
            {formatDate(employee.hireDate)} • {getTenureLabel(employee)}
          </strong>
        </div>
        <div>
          <span>Title code</span>
          {renderValue(employee.titleCode)}
        </div>
      </div>

      <section className="drawer__section">
        <h4>Direct reports</h4>
        <ul className="stack-list">
          {directReports.map((report) => (
            <li key={report.id}>
              <strong>{report.fullName}</strong>
              <span>{report.title}</span>
            </li>
          ))}
          {!directReports.length ? <li>No direct reports found.</li> : null}
        </ul>
      </section>

      <section className="drawer__section">
        <h4>Related employees</h4>
        <ul className="stack-list">
          {relatedEmployees.map((related) => (
            <li key={related.id}>
              <strong>{related.fullName}</strong>
              <span>
                {related.employeeRegion || "No region"} • {related.titleCode || "No title code"}
              </span>
            </li>
          ))}
          {!relatedEmployees.length ? <li>No related employees found.</li> : null}
        </ul>
      </section>

      <a className="button button--ghost" href={api.exportUrl("/export/employees", { search: employee.email })}>
        Export this record via filtered CSV
      </a>
    </aside>
  );
}
