import { formatMoney, isMissing, safeDateLabel, safeString } from "../lib/safe";
import type { ProjectDetailResponse } from "../types";

interface ProjectDrawerProps {
  detail: ProjectDetailResponse | null;
  onClose: () => void;
}

export function ProjectDrawer({ detail, onClose }: ProjectDrawerProps) {
  if (!detail) {
    return null;
  }
  const { project } = detail;
  const renderValue = (value: unknown) =>
    isMissing(value) ? <span className="missing-badge">Missing</span> : <strong>{safeString(value)}</strong>;
  const renderNumber = (value: number | null | undefined) =>
    value == null ? <span className="missing-badge">Missing</span> : <strong>{value.toLocaleString()}</strong>;
  const renderMoney = (value: unknown) =>
    isMissing(value) ? <span className="missing-badge">Missing</span> : <strong>{formatMoney(value, project.projectCurrency)}</strong>;

  return (
    <aside className="drawer">
      <div className="drawer__header">
        <div>
          <p className="page-kicker">Project detail</p>
          <h3>{project.projectName}</h3>
          <p>{project.projectStatus || "Status missing"}</p>
        </div>
        <button className="button" onClick={onClose} type="button">
          Close
        </button>
      </div>
      <div className="profile-card">
        <div><span>Estimated Hours</span>{renderNumber(project.projectEstimatedHrs)}</div>
        <div><span>Currency</span>{renderValue(project.projectCurrency)}</div>
        <div><span>Manager</span>{renderValue(project.projectManager)}</div>
        <div><span>Manager Email</span>{renderValue(project.projectManagerEmail)}</div>
        <div><span>Start Date</span><strong>{safeDateLabel(project.projectStartDate)}</strong></div>
        <div><span>End Date</span><strong>{safeDateLabel(project.projectEndDate)}</strong></div>
        <div><span>Budget Hours</span>{renderNumber(project.budgetHours)}</div>
        <div><span>Budget Cost</span>{renderMoney(project.budgetCost)}</div>
        <div><span>Expense Budget</span>{renderMoney(project.expenseBudgetProjectCurrency)}</div>
        <div><span>Region</span>{renderValue(project.projectRegion)}</div>
        <div><span>PO Number</span>{renderValue(project.poNumber)}</div>
        <div><span>Sold By</span>{renderValue(project.projectSoldBy)}</div>
        <div><span>Resources</span>{renderNumber(project.numberOfResources)}</div>
        <div><span>Work Weeks</span>{renderNumber(project.numberOfWorkWeeks)}</div>
        <div className="profile-card__wide"><span>Description</span>{renderValue(project.projectDescription)}</div>
      </div>
    </aside>
  );
}
