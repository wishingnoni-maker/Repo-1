import { formatDate } from "../lib/format";
import { safeString } from "../lib/safe";
import type { TimeEntry } from "../types";

export function TimeEntryDrawer({ entry }: { entry: TimeEntry }) {
  return (
    <div className="drawer">
      <div className="profile-card">
        {[
          ["Employee", entry.employeeName],
          ["Employee Email", entry.employeeEmail],
          ["Client", entry.clientName || "Missing"],
          ["Project", entry.projectName],
          ["Project Manager", entry.projectManager || "Missing"],
          ["Status", entry.projectStatus || "Missing"],
          ["Work Date", formatDate(entry.workDate)],
          ["Hours", entry.hours.toFixed(2)],
          ["Category", entry.workCategory],
          ["Billable", entry.billable ? "Yes" : "No"]
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
        <div className="profile-card__wide">
          <span>Notes</span>
          <strong>{safeString(entry.notes) || "No notes"}</strong>
        </div>
        <div>
          <span>Created</span>
          <strong>{formatDate(entry.createdAt)}</strong>
        </div>
        <div>
          <span>Updated</span>
          <strong>{formatDate(entry.updatedAt)}</strong>
        </div>
      </div>
    </div>
  );
}
