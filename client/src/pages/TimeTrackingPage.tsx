import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Modal } from "../components/Modal";
import { StatCard } from "../components/StatCard";
import { TimeEntryDrawer } from "../components/TimeEntryDrawer";
import { WeeklyTimesheetGrid } from "../components/WeeklyTimesheetGrid";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import type {
  TimeEntry,
  TimeEntryProjectOption,
  TimesheetClientOption,
  TimesheetDayKey,
  TimesheetEmployeeOption,
  WeeklyTimesheet,
  WeeklyTimesheetRow,
  WeeklyTimesheetTotals
} from "../types";

const tabs = ["Weekly Timesheet", "Submitted Entries", "Team Review", "Export"] as const;
type TimesheetTab = (typeof tabs)[number];

const categories = [
  "Client Work",
  "Project Management",
  "Internal Meeting",
  "Research",
  "Admin",
  "Support",
  "Travel",
  "Training",
  "PTO / Holiday",
  "Other"
] as const;

const nonBillableDefaultCategories = new Set(["PTO / Holiday", "Admin", "Internal Meeting", "Training"]);
const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const satisfies TimesheetDayKey[];

const emptyHours = (): Record<TimesheetDayKey, number> => ({
  mon: 0,
  tue: 0,
  wed: 0,
  thu: 0,
  fri: 0,
  sat: 0,
  sun: 0
});

const mondayOf = (value: Date | string = new Date()) => {
  const parsed = typeof value === "string" ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  const day = parsed.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  parsed.setUTCDate(parsed.getUTCDate() - offset);
  return parsed.toISOString().slice(0, 10);
};

const addDays = (value: string, days: number) => {
  const parsed = new Date(value);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const emptyTotals = (): WeeklyTimesheetTotals => ({
  ...emptyHours(),
  weeklyTotal: 0,
  billableTotal: 0,
  nonBillableTotal: 0
});

const createEmptyRow = (seed?: Partial<WeeklyTimesheetRow>): WeeklyTimesheetRow => ({
  rowGroupId: seed?.rowGroupId ?? crypto.randomUUID(),
  clientId: seed?.clientId ?? null,
  clientName: seed?.clientName ?? "",
  projectId: seed?.projectId ?? "",
  projectName: seed?.projectName ?? "",
  workCategory: seed?.workCategory ?? "Client Work",
  billable: seed?.billable ?? true,
  notes: seed?.notes ?? "",
  holidayOrWeekendReason: seed?.holidayOrWeekendReason ?? "",
  hours: {
    ...emptyHours(),
    ...(seed?.hours ?? {})
  }
});

const calculateTotals = (rows: WeeklyTimesheetRow[]) =>
  rows.reduce<WeeklyTimesheetTotals>((acc, row) => {
    const rowTotal = dayKeys.reduce((sum, key) => sum + (row.hours[key] ?? 0), 0);
    for (const key of dayKeys) {
      acc[key] = Number((acc[key] + (row.hours[key] ?? 0)).toFixed(2));
    }
    acc.weeklyTotal = Number((acc.weeklyTotal + rowTotal).toFixed(2));
    if (row.billable) {
      acc.billableTotal = Number((acc.billableTotal + rowTotal).toFixed(2));
    } else {
      acc.nonBillableTotal = Number((acc.nonBillableTotal + rowTotal).toFixed(2));
    }
    return acc;
  }, emptyTotals());

const rowTotal = (row: WeeklyTimesheetRow) =>
  Number(dayKeys.reduce((sum, key) => sum + (row.hours[key] ?? 0), 0).toFixed(2));

const normalizeStatus = (entries: TimeEntry[]) => {
  if (!entries.length) {
    return "not-started";
  }
  const statuses = new Set(entries.map((entry) => entry.approvalStatus));
  if (statuses.has("draft")) return "draft";
  if (statuses.has("rejected")) return "rejected";
  if (statuses.has("submitted")) return "submitted";
  if (statuses.has("approved")) return "approved";
  return "draft";
};

const shiftWeek = (weekStart: string, days: number) => addDays(weekStart, days);

interface TimeTrackingPageProps {
  refreshToken: number;
  onDataChange: () => void;
}

export function TimeTrackingPage({ refreshToken, onDataChange }: TimeTrackingPageProps) {
  const [activeTab, setActiveTab] = useState<TimesheetTab>("Weekly Timesheet");
  const [employees, setEmployees] = useState<TimesheetEmployeeOption[]>([]);
  const [clients, setClients] = useState<TimesheetClientOption[]>([]);
  const [projects, setProjects] = useState<TimeEntryProjectOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [weekStart, setWeekStart] = useState(mondayOf());
  const [currentWeek, setCurrentWeek] = useState<WeeklyTimesheet | null>(null);
  const [rows, setRows] = useState<WeeklyTimesheetRow[]>([]);
  const [showWeekend, setShowWeekend] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [savingWeek, setSavingWeek] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<{ employeeId: string; weekStart: string } | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<TimeEntry | null>(null);

  const [submittedFilters, setSubmittedFilters] = useState({
    employeeId: "",
    clientId: "",
    projectId: "",
    status: "",
    billable: "",
    startDate: mondayOf(),
    endDate: addDays(mondayOf(), 6),
    search: "",
    page: 1,
    pageSize: 25
  });
  const [submittedEntries, setSubmittedEntries] = useState<TimeEntry[]>([]);
  const [submittedTotal, setSubmittedTotal] = useState(0);
  const [submittedLoading, setSubmittedLoading] = useState(false);
  const [reviewEntries, setReviewEntries] = useState<TimeEntry[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  const days = currentWeek?.days ?? dayKeys.map((key, index) => ({ key, label: key[0].toUpperCase() + key.slice(1, 3), date: addDays(weekStart, index) }));
  const totals = useMemo(() => calculateTotals(rows), [rows]);
  const weekendHoursHidden = !showWeekend && rows.some((row) => (row.hours.sat ?? 0) > 0 || (row.hours.sun ?? 0) > 0);
  const weekEnd = currentWeek?.weekEnd ?? addDays(weekStart, 6);

  const weekStatus = currentWeek?.status ?? "not-started";
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) ?? null;

  const teamReviewRows = useMemo(() => {
    const grouped = new Map<string, { employeeId: string; employeeName: string; totalHours: number; billableHours: number; nonBillableHours: number; entries: TimeEntry[] }>();
    for (const entry of reviewEntries) {
      const current =
        grouped.get(entry.employeeId) ?? {
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
          totalHours: 0,
          billableHours: 0,
          nonBillableHours: 0,
          entries: []
        };
      current.totalHours += entry.hours;
      if (entry.billable) {
        current.billableHours += entry.hours;
      } else {
        current.nonBillableHours += entry.hours;
      }
      current.entries.push(entry);
      grouped.set(entry.employeeId, current);
    }

    return employees
      .map((employee) => {
        const current = grouped.get(employee.id);
        return {
          employeeId: employee.id,
          employeeName: employee.fullName,
          totalHours: Number((current?.totalHours ?? 0).toFixed(2)),
          billableHours: Number((current?.billableHours ?? 0).toFixed(2)),
          nonBillableHours: Number((current?.nonBillableHours ?? 0).toFixed(2)),
          status: normalizeStatus(current?.entries ?? [])
        };
      })
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [employees, reviewEntries]);

  const teamReviewStats = useMemo(() => {
    const employeesSubmitted = teamReviewRows.filter((row) => row.status === "submitted" || row.status === "approved").length;
    const employeesMissing = teamReviewRows.filter((row) => row.status === "not-started").length;
    const totalHours = Number(teamReviewRows.reduce((sum, row) => sum + row.totalHours, 0).toFixed(2));
    const billableHours = Number(teamReviewRows.reduce((sum, row) => sum + row.billableHours, 0).toFixed(2));
    const nonBillableHours = Number(teamReviewRows.reduce((sum, row) => sum + row.nonBillableHours, 0).toFixed(2));
    return {
      employeesSubmitted,
      employeesMissing,
      totalHours,
      billableHours,
      nonBillableHours
    };
  }, [teamReviewRows]);

  const exportCurrentWeekUrl = selectedEmployeeId
    ? api.exportUrl("/timesheets/export", { employeeId: selectedEmployeeId, weekStart })
    : "";

  const loadOptions = async () => {
    setLoadingOptions(true);
    try {
      const [employeeRows, clientRows, projectRows] = await Promise.all([
        api.getTimesheetEmployeeOptions(),
        api.getTimesheetClientOptions(),
        api.getTimesheetProjectOptions()
      ]);
      setEmployees(employeeRows);
      setClients(clientRows);
      setProjects(projectRows);
      if (!selectedEmployeeId && employeeRows[0]?.id) {
        setSelectedEmployeeId(employeeRows[0].id);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load timesheet options.");
    } finally {
      setLoadingOptions(false);
    }
  };

  const loadWeek = async (employeeId: string, targetWeekStart: string) => {
    if (!employeeId) {
      setCurrentWeek(null);
      setRows([createEmptyRow()]);
      return;
    }
    setLoadingWeek(true);
    setError("");
    try {
      const week = await api.getTimesheetWeek(employeeId, targetWeekStart);
      setCurrentWeek(week);
      setRows(week.rows.length ? week.rows.map((row) => createEmptyRow(row)) : [createEmptyRow()]);
      setShowWeekend(week.showWeekend);
      setDirty(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load the weekly timesheet.");
    } finally {
      setLoadingWeek(false);
    }
  };

  const loadSubmittedEntries = async () => {
    setSubmittedLoading(true);
    try {
      const response = await api.getTimesheets({
        employeeId: submittedFilters.employeeId || undefined,
        clientId: submittedFilters.clientId || undefined,
        projectId: submittedFilters.projectId || undefined,
        status: submittedFilters.status || undefined,
        billable:
          submittedFilters.billable === ""
            ? undefined
            : submittedFilters.billable === "true",
        startDate: submittedFilters.startDate || undefined,
        endDate: submittedFilters.endDate || undefined,
        search: submittedFilters.search || undefined,
        page: submittedFilters.page,
        pageSize: submittedFilters.pageSize
      });
      setSubmittedEntries(response.data);
      setSubmittedTotal(response.total);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load submitted entries.");
    } finally {
      setSubmittedLoading(false);
    }
  };

  const loadTeamReview = async () => {
    setReviewLoading(true);
    try {
      const response = await api.getTimesheets({
        startDate: weekStart,
        endDate: weekEnd,
        page: 1,
        pageSize: 5000
      });
      setReviewEntries(response.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load team review.");
    } finally {
      setReviewLoading(false);
    }
  };

  useEffect(() => {
    void loadOptions();
  }, [refreshToken]);

  useEffect(() => {
    if (selectedEmployeeId) {
      void loadWeek(selectedEmployeeId, weekStart);
    }
  }, [selectedEmployeeId, weekStart, refreshToken]);

  useEffect(() => {
    if (activeTab === "Submitted Entries") {
      void loadSubmittedEntries();
    }
  }, [activeTab, submittedFilters, refreshToken]);

  useEffect(() => {
    if (activeTab === "Team Review") {
      void loadTeamReview();
    }
  }, [activeTab, weekStart, refreshToken]);

  const requestWeekChange = (next: { employeeId: string; weekStart: string }) => {
    if (dirty) {
      setPendingSelection(next);
      setConfirmDiscardOpen(true);
      return;
    }
    setSelectedEmployeeId(next.employeeId);
    setWeekStart(next.weekStart);
  };

  const applyPendingSelection = () => {
    if (!pendingSelection) return;
    setSelectedEmployeeId(pendingSelection.employeeId);
    setWeekStart(pendingSelection.weekStart);
    setPendingSelection(null);
    setConfirmDiscardOpen(false);
  };

  const markDirty = () => {
    setDirty(true);
    setSuccess("");
  };

  const updateRow = (rowGroupId: string, patch: Partial<WeeklyTimesheetRow>) => {
    setRows((current) =>
      current.map((row) => {
        if (row.rowGroupId !== rowGroupId) {
          return row;
        }
        const next = { ...row, ...patch };
        if (patch.workCategory && nonBillableDefaultCategories.has(patch.workCategory)) {
          next.billable = false;
        }
        return next;
      })
    );
    markDirty();
  };

  const updateHours = (rowGroupId: string, dayKey: TimesheetDayKey, value: number) => {
    const normalized = Number.isFinite(value) ? Math.min(24, Math.max(0, value)) : 0;
    setRows((current) =>
      current.map((row) =>
        row.rowGroupId === rowGroupId
          ? { ...row, hours: { ...row.hours, [dayKey]: Number(normalized.toFixed(2)) } }
          : row
      )
    );
    markDirty();
  };

  const addRow = (seed?: Partial<WeeklyTimesheetRow>) => {
    setRows((current) => [...current, createEmptyRow(seed)]);
    markDirty();
  };

  const duplicateRow = (rowGroupId: string) => {
    const row = rows.find((candidate) => candidate.rowGroupId === rowGroupId);
    if (!row) return;
    addRow({
      ...row,
      rowGroupId: crypto.randomUUID(),
      hours: { ...row.hours }
    });
  };

  const deleteRow = (rowGroupId: string) => {
    setRows((current) => {
      const next = current.filter((row) => row.rowGroupId !== rowGroupId);
      return next.length ? next : [createEmptyRow()];
    });
    markDirty();
  };

  const clearEmptyRows = () => {
    setRows((current) => {
      const next = current.filter((row) => rowTotal(row) > 0 || row.projectId || row.notes || row.clientId);
      return next.length ? next : [createEmptyRow()];
    });
    markDirty();
  };

  const buildSavePayload = (status: "draft" | "submitted") => ({
    employeeId: selectedEmployeeId,
    weekStart,
    status,
    showWeekend,
    rows: rows.map((row) => ({
      rowGroupId: row.rowGroupId,
      clientId: row.clientId,
      projectId: row.projectId,
      workCategory: row.workCategory,
      billable: row.billable,
      notes: row.notes,
      holidayOrWeekendReason: row.holidayOrWeekendReason,
      hours: row.hours
    }))
  });

  const persistWeek = async (status: "draft" | "submitted") => {
    if (!selectedEmployeeId) {
      setError("Select an employee before saving the weekly timesheet.");
      return;
    }
    if (status === "submitted" && totals.weeklyTotal <= 0) {
      setError("Weekly total is 0. Add hours before submitting.");
      return;
    }
    setSavingWeek(true);
    setError("");
    setSuccess("");
    try {
      const response = await api.saveTimesheetWeek(buildSavePayload(status));
      setCurrentWeek(response);
      setRows(response.rows.length ? response.rows.map((row) => createEmptyRow(row)) : [createEmptyRow()]);
      setDirty(false);
      setSuccess(status === "submitted" ? "Timesheet submitted." : "Timesheet saved.");
      onDataChange();
      if (activeTab === "Submitted Entries") {
        void loadSubmittedEntries();
      }
      if (activeTab === "Team Review") {
        void loadTeamReview();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save the weekly timesheet.");
    } finally {
      setSavingWeek(false);
    }
  };

  const copyPreviousWeek = async () => {
    if (!selectedEmployeeId) {
      setError("Select an employee before copying a previous week.");
      return;
    }
    setSavingWeek(true);
    setError("");
    setSuccess("");
    try {
      const response = await api.copyPreviousTimesheetWeek(selectedEmployeeId, weekStart);
      setCurrentWeek(response);
      setRows(response.rows.length ? response.rows.map((row) => createEmptyRow(row)) : [createEmptyRow()]);
      setShowWeekend(response.showWeekend);
      setDirty(true);
      setSuccess("Previous week copied. Hours were reset to 0.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to copy the previous week.");
    } finally {
      setSavingWeek(false);
    }
  };

  return (
    <div className="page-grid time-tracking-page">
      <section className="panel time-tracking-header-card">
        <div className="time-tracking-header-top">
          <div>
            <h3>Time Tracking</h3>
            <p>Submit weekly project hours by employee, client, and project.</p>
          </div>
          <div className="tabbar time-tracking-tabs">
            {tabs.map((tab) => (
              <button
                key={tab}
                className={`tabbar__item${activeTab === tab ? " tabbar__item--active" : ""}`}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="time-tracking-toolbar">
          <div className="time-tracking-control-group time-tracking-control-group--selectors">
            <label>
              <span>Employee</span>
              <select
                disabled={loadingOptions}
                value={selectedEmployeeId}
                onChange={(event) => requestWeekChange({ employeeId: event.target.value, weekStart })}
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName} — {employee.title || "No title"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Week start</span>
              <input
                type="date"
                value={weekStart}
                onChange={(event) => requestWeekChange({ employeeId: selectedEmployeeId, weekStart: mondayOf(event.target.value) })}
              />
            </label>

            <label className="toggle time-tracking-toggle">
              <input checked={showWeekend} onChange={(event) => { setShowWeekend(event.target.checked); markDirty(); }} type="checkbox" />
              <span>Show weekend</span>
            </label>
          </div>

          <div className="time-tracking-control-group time-tracking-control-group--navigation">
            <button className="button" onClick={() => requestWeekChange({ employeeId: selectedEmployeeId, weekStart: shiftWeek(weekStart, -7) })} type="button">Previous week</button>
            <button className="button" onClick={() => requestWeekChange({ employeeId: selectedEmployeeId, weekStart: shiftWeek(weekStart, 7) })} type="button">Next week</button>
            <button className="button button--ghost" onClick={() => requestWeekChange({ employeeId: selectedEmployeeId, weekStart: mondayOf() })} type="button">Current week</button>
          </div>

          <div className="time-tracking-control-group time-tracking-control-group--actions">
            <button className="button" disabled={!selectedEmployeeId || savingWeek} onClick={() => void copyPreviousWeek()} type="button">
              Copy previous week
            </button>
            <button className="button" disabled={!selectedEmployeeId || savingWeek} onClick={() => void persistWeek("draft")} type="button">
              Save draft
            </button>
            <button className="button button--primary" disabled={!selectedEmployeeId || savingWeek} onClick={() => void persistWeek("submitted")} type="button">
              Submit week
            </button>
            <a className={`button${!exportCurrentWeekUrl ? " button--disabled" : ""}`} href={exportCurrentWeekUrl || undefined}>
              Export current week
            </a>
          </div>
        </div>

        <div className="badge-row">
          <span className="badge badge--info">{selectedEmployee?.fullName || "No employee selected"}</span>
          <span className="badge badge--neutral">{formatDate(weekStart)} to {formatDate(weekEnd)}</span>
          <span className={`badge badge--${weekStatus === "submitted" || weekStatus === "approved" ? "success" : weekStatus === "draft" ? "warn" : "neutral"}`}>
            {weekStatus}
          </span>
        </div>

        {weekendHoursHidden ? (
          <div className="helper-banner">
            <strong>Weekend hours exist for this week.</strong>
            <span>They are hidden while weekend columns are off, but they have not been deleted.</span>
          </div>
        ) : null}

        {error ? <div className="error-text">{error}</div> : null}
        {success ? <div className="helper-banner"><strong>Saved</strong><span>{success}</span></div> : null}
      </section>

      {activeTab === "Weekly Timesheet" ? (
        <>
          <section className="stat-grid time-summary-grid">
            <StatCard label="Week total" value={totals.weeklyTotal.toFixed(2)} tone="accent" />
            <StatCard label="Billable" value={totals.billableTotal.toFixed(2)} />
            <StatCard label="Non-billable" value={totals.nonBillableTotal.toFixed(2)} />
            <StatCard label="Rows" value={rows.length} />
          </section>
          {loadingWeek ? (
            <section className="panel"><div className="hint-box">Loading weekly timesheet…</div></section>
          ) : (
            <WeeklyTimesheetGrid
              categories={categories}
              clients={clients}
              days={days}
              onAddNonBillableRow={() => addRow({ billable: false, workCategory: "Admin" })}
              onAddRow={() => addRow()}
              onChangeHours={updateHours}
              onChangeRow={updateRow}
              onClearEmptyRows={clearEmptyRows}
              onDeleteRow={deleteRow}
              onDuplicateRow={duplicateRow}
              projects={projects}
              rows={rows}
              saving={savingWeek}
              showWeekend={showWeekend}
              totals={totals}
            />
          )}
        </>
      ) : null}

      {activeTab === "Submitted Entries" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h3>Submitted Entries</h3>
              <p>Review saved time rows across employees, clients, projects, and status.</p>
            </div>
          </div>
          <div className="filters">
            <label>
              <span>Employee</span>
              <select value={submittedFilters.employeeId} onChange={(event) => setSubmittedFilters((current) => ({ ...current, employeeId: event.target.value, page: 1 }))}>
                <option value="">All employees</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.fullName}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Client</span>
              <select value={submittedFilters.clientId} onChange={(event) => setSubmittedFilters((current) => ({ ...current, clientId: event.target.value, page: 1 }))}>
                <option value="">All clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.clientName}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Project</span>
              <select value={submittedFilters.projectId} onChange={(event) => setSubmittedFilters((current) => ({ ...current, projectId: event.target.value, page: 1 }))}>
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.projectName}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={submittedFilters.status} onChange={(event) => setSubmittedFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
                <option value="">All statuses</option>
                <option value="draft">draft</option>
                <option value="submitted">submitted</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
            </label>
            <label>
              <span>Billable</span>
              <select value={submittedFilters.billable} onChange={(event) => setSubmittedFilters((current) => ({ ...current, billable: event.target.value, page: 1 }))}>
                <option value="">All</option>
                <option value="true">Billable only</option>
                <option value="false">Non-billable only</option>
              </select>
            </label>
            <label>
              <span>Search</span>
              <input value={submittedFilters.search} onChange={(event) => setSubmittedFilters((current) => ({ ...current, search: event.target.value, page: 1 }))} />
            </label>
            <label>
              <span>Start date</span>
              <input type="date" value={submittedFilters.startDate} onChange={(event) => setSubmittedFilters((current) => ({ ...current, startDate: event.target.value, page: 1 }))} />
            </label>
            <label>
              <span>End date</span>
              <input type="date" value={submittedFilters.endDate} onChange={(event) => setSubmittedFilters((current) => ({ ...current, endDate: event.target.value, page: 1 }))} />
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Client</th>
                  <th>Project</th>
                  <th>Work Type</th>
                  <th>Hours</th>
                  <th>Billable</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submittedEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.workDate)}</td>
                    <td>{entry.employeeName}</td>
                    <td>{entry.clientName || "Unassigned"}</td>
                    <td>{entry.projectName}</td>
                    <td>{entry.workCategory}</td>
                    <td>{entry.hours.toFixed(2)}</td>
                    <td>{entry.billable ? "Yes" : "No"}</td>
                    <td><span className={`status-pill status-pill--${entry.approvalStatus}`}>{entry.approvalStatus}</span></td>
                    <td>{entry.notes || "No notes"}</td>
                    <td>
                      <div className="row-actions">
                        <button className="button" onClick={() => setViewEntry(entry)} type="button">View</button>
                        <button
                          className="button"
                          onClick={() => {
                            requestWeekChange({
                              employeeId: entry.employeeId,
                              weekStart: entry.timesheetWeekStart ?? mondayOf(entry.workDate)
                            });
                            setActiveTab("Weekly Timesheet");
                          }}
                          type="button"
                        >
                          Edit week
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!submittedEntries.length ? (
                  <tr>
                    <td colSpan={10}><div className="hint-box">{submittedLoading ? "Loading entries…" : "No submitted entries match the current filters."}</div></td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>Page {submittedFilters.page} of {Math.max(1, Math.ceil(submittedTotal / submittedFilters.pageSize))}</span>
            <div className="pagination__actions">
              <button className="button" disabled={submittedFilters.page <= 1} onClick={() => setSubmittedFilters((current) => ({ ...current, page: current.page - 1 }))} type="button">Previous</button>
              <button className="button" disabled={submittedFilters.page >= Math.max(1, Math.ceil(submittedTotal / submittedFilters.pageSize))} onClick={() => setSubmittedFilters((current) => ({ ...current, page: current.page + 1 }))} type="button">Next</button>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "Team Review" ? (
        <>
          <section className="stat-grid">
            <StatCard label="Employees submitted" value={teamReviewStats.employeesSubmitted} tone="accent" />
            <StatCard label="Employees missing time" value={teamReviewStats.employeesMissing} tone="warn" />
            <StatCard label="Total hours submitted" value={teamReviewStats.totalHours.toFixed(2)} />
            <StatCard label="Billable / Non-billable" value={`${teamReviewStats.billableHours.toFixed(2)} / ${teamReviewStats.nonBillableHours.toFixed(2)}`} />
          </section>
          <section className="panel">
            <div className="panel__header">
              <div>
                <h3>Team Review</h3>
                <p>Review weekly totals and submission status across the consulting team.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Status</th>
                    <th>Total Hours</th>
                    <th>Billable</th>
                    <th>Non-billable</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamReviewRows.map((row) => (
                    <tr key={row.employeeId}>
                      <td>{row.employeeName}</td>
                      <td><span className={`badge badge--${row.status === "submitted" || row.status === "approved" ? "success" : row.status === "draft" ? "warn" : "neutral"}`}>{row.status}</span></td>
                      <td>{row.totalHours.toFixed(2)}</td>
                      <td>{row.billableHours.toFixed(2)}</td>
                      <td>{row.nonBillableHours.toFixed(2)}</td>
                      <td>
                        <button
                          className="button"
                          onClick={() => {
                            requestWeekChange({ employeeId: row.employeeId, weekStart });
                            setActiveTab("Weekly Timesheet");
                          }}
                          type="button"
                        >
                          Open week
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!teamReviewRows.length ? (
                    <tr><td colSpan={6}><div className="hint-box">{reviewLoading ? "Loading team review…" : "No team review data yet for this week."}</div></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "Export" ? (
        <div className="page-grid page-grid--two">
          <section className="panel">
            <div className="panel__header">
              <div>
                <h3>Export Current Week</h3>
                <p>Download the weekly sheet in an Excel-friendly CSV layout.</p>
              </div>
            </div>
            <div className="stack-list-wrapper">
              <ul className="stack-list">
                <li>
                  <strong>Current selection</strong>
                  <span>{selectedEmployee?.fullName || "No employee selected"} • {formatDate(weekStart)} to {formatDate(weekEnd)}</span>
                </li>
                <li>
                  <strong>Current total</strong>
                  <span>{totals.weeklyTotal.toFixed(2)} hrs</span>
                </li>
              </ul>
            </div>
            <div className="row-actions">
              <a className={`button button--primary${!exportCurrentWeekUrl ? " button--disabled" : ""}`} href={exportCurrentWeekUrl || undefined}>
                Export current week
              </a>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <h3>What Exports</h3>
                <p>The export is built for spreadsheet use, not profitability review.</p>
              </div>
            </div>
            <div className="stack-list-wrapper">
              <ul className="stack-list">
                <li>Employee</li>
                <li>Week Start</li>
                <li>Client</li>
                <li>Project</li>
                <li>Work Type</li>
                <li>Billable</li>
                <li>Notes</li>
                <li>Monday through Sunday hours</li>
                <li>Total hours</li>
              </ul>
            </div>
          </section>
        </div>
      ) : null}

      <Modal open={Boolean(viewEntry)} onClose={() => setViewEntry(null)} title="Time Entry Detail">
        {viewEntry ? <TimeEntryDrawer entry={viewEntry} /> : null}
      </Modal>

      <ConfirmDialog
        open={confirmDiscardOpen}
        title="Discard Unsaved Timesheet Changes?"
        message="You have unsaved changes for this weekly timesheet. Switch the employee or week anyway?"
        onCancel={() => {
          setPendingSelection(null);
          setConfirmDiscardOpen(false);
        }}
        onConfirm={applyPendingSelection}
      />
    </div>
  );
}
