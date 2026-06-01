import { formatDate } from "../lib/format";
import type {
  TimeEntryProjectOption,
  TimesheetClientOption,
  TimesheetDayKey,
  WeeklyTimesheetDay,
  WeeklyTimesheetRow,
  WeeklyTimesheetTotals
} from "../types";

interface WeeklyTimesheetGridProps {
  days: WeeklyTimesheetDay[];
  showWeekend: boolean;
  rows: WeeklyTimesheetRow[];
  clients: TimesheetClientOption[];
  projects: TimeEntryProjectOption[];
  categories: readonly string[];
  saving: boolean;
  totals: WeeklyTimesheetTotals;
  onAddRow: () => void;
  onAddNonBillableRow: () => void;
  onClearEmptyRows: () => void;
  onDuplicateRow: (rowGroupId: string) => void;
  onDeleteRow: (rowGroupId: string) => void;
  onChangeRow: (rowGroupId: string, patch: Partial<WeeklyTimesheetRow>) => void;
  onChangeHours: (rowGroupId: string, dayKey: TimesheetDayKey, value: number) => void;
}

const workdayKeys = new Set<TimesheetDayKey>(["mon", "tue", "wed", "thu", "fri"]);

const rowTotal = (row: WeeklyTimesheetRow, dayKeys: TimesheetDayKey[]) =>
  dayKeys.reduce((sum, key) => sum + (row.hours[key] ?? 0), 0);

export function WeeklyTimesheetGrid({
  days,
  showWeekend,
  rows,
  clients,
  projects,
  categories,
  saving,
  totals,
  onAddRow,
  onAddNonBillableRow,
  onClearEmptyRows,
  onDuplicateRow,
  onDeleteRow,
  onChangeRow,
  onChangeHours
}: WeeklyTimesheetGridProps) {
  const visibleDays = showWeekend ? days : days.filter((day) => workdayKeys.has(day.key));
  const visibleDayKeys = visibleDays.map((day) => day.key);

  return (
    <section className="panel timesheet-card">
      <div className="panel__header">
        <div>
          <h3>Weekly Timesheet</h3>
          <p>Enter hours in a compact weekly grid, one row per client/project/work type combination.</p>
        </div>
        <div className="row-actions">
          <button className="button" onClick={onAddRow} type="button">Add row</button>
          <button className="button button--ghost" onClick={onAddNonBillableRow} type="button">Add non-billable row</button>
          <button className="button" onClick={onClearEmptyRows} type="button">Clear empty rows</button>
        </div>
      </div>

      <div className="table-wrap timesheet-grid-wrap timesheet-table-wrapper">
        <table className="timesheet-grid weekly-timesheet-grid">
          <colgroup>
            <col style={{ width: "160px" }} />
            <col style={{ width: "240px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "72px" }} />
            <col style={{ width: "190px" }} />
            {visibleDays.map((day) => (
              <col key={day.key} style={{ width: "72px" }} />
            ))}
            <col style={{ width: "84px" }} />
            <col style={{ width: "120px" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Client</th>
              <th>Project</th>
              <th>Work Type</th>
              <th>Billable</th>
              <th>Notes / Description</th>
              {visibleDays.map((day) => (
                <th key={day.key}>
                  <div className="timesheet-day-heading">
                    <strong>{day.label}</strong>
                    <span>{formatDate(day.date)}</span>
                  </div>
                </th>
              ))}
              <th>Row Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => {
                const projectOptions = row.clientId
                  ? (() => {
                      const matching = projects.filter((project) => project.clientId === row.clientId);
                      return matching.length ? matching : projects;
                    })()
                  : projects;

                return (
                  <tr key={row.rowGroupId} className="timesheet-row">
                    <td className="timesheet-cell timesheet-cell--client">
                      <select
                        value={row.clientId ?? ""}
                        onChange={(event) => onChangeRow(row.rowGroupId, { clientId: event.target.value || null })}
                      >
                        <option value="">Unassigned</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>{client.clientName}</option>
                        ))}
                      </select>
                    </td>
                    <td className="timesheet-cell timesheet-cell--project">
                      <select
                        value={row.projectId}
                        onChange={(event) => {
                          const nextProject = projects.find((project) => project.id === event.target.value) ?? null;
                          onChangeRow(row.rowGroupId, {
                            projectId: event.target.value,
                            clientId: row.clientId || nextProject?.clientId || null
                          });
                        }}
                      >
                        <option value="">Select project</option>
                        {projectOptions.map((project) => (
                          <option key={project.id} value={project.id}>{project.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="timesheet-cell timesheet-cell--category">
                      <select
                        value={row.workCategory}
                        onChange={(event) => onChangeRow(row.rowGroupId, { workCategory: event.target.value })}
                      >
                        {categories.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </td>
                    <td className="timesheet-cell timesheet-cell--billable">
                      <input
                        checked={row.billable}
                        onChange={(event) => onChangeRow(row.rowGroupId, { billable: event.target.checked })}
                        type="checkbox"
                      />
                    </td>
                    <td className="timesheet-cell timesheet-cell--notes">
                      <div className="timesheet-notes-cell">
                        <input
                          placeholder="Describe the work"
                          value={row.notes}
                          onChange={(event) => onChangeRow(row.rowGroupId, { notes: event.target.value })}
                        />
                        {(row.hours.sat > 0 || row.hours.sun > 0) ? (
                          <input
                            placeholder="Weekend / holiday reason"
                            value={row.holidayOrWeekendReason}
                            onChange={(event) => onChangeRow(row.rowGroupId, { holidayOrWeekendReason: event.target.value })}
                          />
                        ) : null}
                      </div>
                    </td>
                    {visibleDays.map((day) => (
                      <td key={day.key} className="timesheet-cell timesheet-cell--day">
                        <input
                          className="timesheet-hours-input timesheet-day-input"
                          min="0"
                          max="24"
                          step="0.25"
                          type="number"
                          value={row.hours[day.key] === 0 ? "" : String(row.hours[day.key])}
                          onChange={(event) => onChangeHours(row.rowGroupId, day.key, event.target.value === "" ? 0 : Number(event.target.value))}
                          onFocus={(event) => event.currentTarget.select()}
                        />
                      </td>
                    ))}
                    <td className="timesheet-cell timesheet-cell--total"><strong>{rowTotal(row, visibleDayKeys).toFixed(2)}</strong></td>
                    <td className="timesheet-cell timesheet-cell--actions">
                      <div className="row-actions timesheet-actions">
                        <button className="button button--ghost" onClick={() => onDuplicateRow(row.rowGroupId)} type="button">Duplicate</button>
                        <button className="button button--danger" onClick={() => onDeleteRow(row.rowGroupId)} type="button">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={visibleDays.length + 7}>
                  <div className="hint-box">No timesheet rows yet. Add a row to start tracking this week.</div>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}><strong>Daily Totals</strong></td>
              {visibleDays.map((day) => (
                <td key={day.key}><strong>{totals[day.key].toFixed(2)}</strong></td>
              ))}
              <td><strong>{totals.weeklyTotal.toFixed(2)}</strong></td>
              <td>{saving ? "Saving..." : ""}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="timesheet-footer-summary">
        <span><strong>Billable:</strong> {totals.billableTotal.toFixed(2)} hrs</span>
        <span><strong>Non-billable:</strong> {totals.nonBillableTotal.toFixed(2)} hrs</span>
        <span><strong>Weekly total:</strong> {totals.weeklyTotal.toFixed(2)} hrs</span>
      </div>
    </section>
  );
}
