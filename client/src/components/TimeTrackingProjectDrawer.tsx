import { formatDate } from "../lib/format";
import { formatMoney } from "../lib/safe";
import type { TimeTrackingProjectDetail } from "../types";

const renderMetric = (value: number | null, suffix = "") =>
  value == null ? "Missing" : `${value.toFixed(2)}${suffix}`;

export function TimeTrackingProjectDrawer({
  detail
}: {
  detail: TimeTrackingProjectDetail;
}) {
  return (
    <div className="drawer">
      <div className="drawer__header">
        <div>
          <h3>{detail.projectName}</h3>
          <p>{detail.clientName || "Unassigned client"} • {detail.projectManager || "No manager"} • {detail.projectStatus || "No status"}</p>
        </div>
      </div>

      <div className="summary-grid">
        <div><span>Start</span><strong>{formatDate(detail.projectStartDate)}</strong></div>
        <div><span>End</span><strong>{formatDate(detail.projectEndDate)}</strong></div>
        <div><span>Planned LOE</span><strong>{renderMetric(detail.plannedLoeHours)}</strong></div>
        <div><span>Actual LOE</span><strong>{detail.actualLoeHours.toFixed(2)}</strong></div>
        <div><span>Remaining LOE</span><strong>{renderMetric(detail.remainingLoeHours)}</strong></div>
        <div><span>LOE Used %</span><strong>{detail.loeUsedPercent == null ? "Missing" : `${detail.loeUsedPercent.toFixed(1)}%`}</strong></div>
        <div><span>Sold Amount</span><strong>{detail.soldAmount == null ? "Missing" : formatMoney(detail.soldAmount)}</strong></div>
        <div><span>Actual Cost</span><strong>{detail.actualCost == null ? "Missing" : formatMoney(detail.actualCost)}</strong></div>
        <div><span>Profit</span><strong>{detail.profit == null ? "Missing" : formatMoney(detail.profit)}</strong></div>
        <div><span>Margin %</span><strong>{detail.marginPercent == null ? "Missing" : `${detail.marginPercent.toFixed(1)}%`}</strong></div>
        <div><span>Profitability</span><strong>{detail.profitabilityStatus}</strong></div>
        <div><span>Assigned Employees</span><strong>{detail.assignedEmployeeCount}</strong></div>
      </div>

      <div className="panel__body">
        <h4>Assigned Employees</h4>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Planned Hours</th>
                <th>Bill Rate</th>
                <th>Cost Rate</th>
                <th>Allocation %</th>
              </tr>
            </thead>
            <tbody>
              {detail.assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>{assignment.employeeName}</td>
                  <td>{assignment.roleOnProject || "Missing"}</td>
                  <td>{renderMetric(assignment.plannedHours)}</td>
                  <td>{assignment.billRate == null ? "Missing" : formatMoney(assignment.billRate)}</td>
                  <td>{assignment.costRate == null ? "Missing" : formatMoney(assignment.costRate)}</td>
                  <td>{assignment.allocationPercent == null ? "Missing" : `${assignment.allocationPercent.toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel__body">
        <h4>Recent Time Entries</h4>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Category</th>
                <th>Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {detail.timeEntries.slice(0, 10).map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(entry.workDate)}</td>
                  <td>{entry.employeeName}</td>
                  <td>{entry.workCategory}</td>
                  <td>{entry.hours.toFixed(2)}</td>
                  <td>{entry.approvalStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
