import { useEffect, useMemo, useState } from "react";
import { formatDate } from "../lib/format";
import { formatMoney, isMissing, safeString } from "../lib/safe";
import type { Client, ProjectAssignment, TimeEntry, TimeEntryEmployeeOption, TimeEntryProjectOption } from "../types";

const categories = [
  "Client Work",
  "Project Management",
  "Internal Meeting",
  "Research",
  "Admin",
  "Support",
  "Travel",
  "Other"
] as const;

const todayLabel = () => new Date().toISOString().slice(0, 10);
const shiftedDateLabel = (days: number) => {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};

type TimeEntryFormState = {
  employeeId: string;
  projectId: string;
  clientId: string;
  workDate: string;
  hours: string;
  workCategory: string;
  billable: boolean;
  notes: string;
};

const toFormState = (value?: Partial<TimeEntry>): TimeEntryFormState => ({
  employeeId: value?.employeeId ?? "",
  projectId: value?.projectId ?? "",
  clientId: value?.clientId ?? "",
  workDate: value?.workDate ?? todayLabel(),
  hours: value?.hours != null ? String(value.hours) : "",
  workCategory: value?.workCategory ?? "Client Work",
  billable: value?.billable ?? true,
  notes: value?.notes ?? ""
});

interface TimeEntryFormProps {
  initialValue?: Partial<TimeEntry>;
  employees: TimeEntryEmployeeOption[];
  projects: TimeEntryProjectOption[];
  clients: Client[];
  loadingEmployees?: boolean;
  loadingProjects?: boolean;
  loadingClients?: boolean;
  trackedHoursByProject?: Record<string, number>;
  projectAssignmentsByProject?: Record<string, ProjectAssignment[]>;
  onSubmit: (value: {
    employeeId: string;
    projectId: string;
    clientId: string | null;
    workDate: string;
    hours: number;
    workCategory: string;
    billable: boolean;
    notes: string;
  }) => Promise<void>;
  submitLabel: string;
}

export function TimeEntryForm({
  initialValue,
  employees,
  projects,
  clients,
  loadingEmployees = false,
  loadingProjects = false,
  loadingClients = false,
  trackedHoursByProject = {},
  projectAssignmentsByProject = {},
  onSubmit,
  submitLabel
}: TimeEntryFormProps) {
  const [formState, setFormState] = useState<TimeEntryFormState>(toFormState(initialValue));
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setFormState(toFormState(initialValue));
    setEmployeeSearch("");
    setProjectSearch("");
    setError("");
  }, [initialValue]);

  const selectedProject = projects.find((project) => project.id === formState.projectId) ?? null;
  const assignedEmployees = selectedProject ? projectAssignmentsByProject[selectedProject.id] ?? [] : [];
  const activeAssignedEmployees = assignedEmployees.filter((assignment) => assignment.active);
  const assignedEmployeeIds = useMemo(
    () => new Set(assignedEmployees.filter((assignment) => assignment.active).map((assignment) => assignment.employeeId)),
    [assignedEmployees]
  );
  const visibleEmployees = useMemo(() => {
    const filtered = employees.filter((employee) =>
      [employee.fullName, employee.email, employee.title, employee.employeeRegion]
        .join(" ")
        .toLowerCase()
        .includes(employeeSearch.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      const aAssigned = assignedEmployeeIds.has(a.id) ? 0 : 1;
      const bAssigned = assignedEmployeeIds.has(b.id) ? 0 : 1;
      return aAssigned - bAssigned || a.fullName.localeCompare(b.fullName);
    });
  }, [assignedEmployeeIds, employeeSearch, employees]);

  const visibleProjects = useMemo(
    () =>
      projects.filter((project) => project.label.toLowerCase().includes(projectSearch.toLowerCase())),
    [projectSearch, projects]
  );

  const trackedHoursForProject = selectedProject ? trackedHoursByProject[selectedProject.id] ?? 0 : 0;
  const remainingHours =
    selectedProject?.remainingLoeHours != null
      ? selectedProject.remainingLoeHours
      : selectedProject?.budgetHours == null
        ? null
        : Number((selectedProject.budgetHours - trackedHoursForProject).toFixed(2));
  const percentUsed =
    selectedProject?.loeUsedPercent != null
      ? selectedProject.loeUsedPercent
      : selectedProject?.budgetHours && selectedProject.budgetHours > 0
        ? Number(((trackedHoursForProject / selectedProject.budgetHours) * 100).toFixed(1))
        : null;
  const selectedEmployeeAssigned =
    !selectedProject || !formState.employeeId || assignedEmployeeIds.size === 0 || assignedEmployeeIds.has(formState.employeeId);

  return (
    <form
      className="form-grid time-entry-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const hours = Number(formState.hours);
        if (!formState.employeeId) {
          setError("Employee is required.");
          return;
        }
        if (!formState.projectId) {
          setError("Project is required.");
          return;
        }
        if (!formState.workDate) {
          setError("Work date is required.");
          return;
        }
        if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
          setError("Hours must be greater than 0 and no more than 24.");
          return;
        }
        if (safeString(formState.notes).length > 1000) {
          setError("Notes must be 1000 characters or fewer.");
          return;
        }

        setSaving(true);
        setError("");
        try {
          await onSubmit({
            employeeId: formState.employeeId,
            projectId: formState.projectId,
            clientId: formState.clientId || null,
            workDate: formState.workDate,
            hours,
            workCategory: formState.workCategory,
            billable: formState.billable,
            notes: formState.notes.trim()
          });
          if (!initialValue?.id) {
            setFormState(toFormState());
          }
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Failed to save time entry.");
        } finally {
          setSaving(false);
        }
      }}
    >
      <label>
        <span>Employee search</span>
        <input
          placeholder="Filter employees"
          value={employeeSearch}
          disabled={loadingEmployees || !employees.length}
          onChange={(event) => setEmployeeSearch(event.target.value)}
        />
      </label>
      <label>
        <span>Employee</span>
        <select
          disabled={loadingEmployees || !employees.length}
          value={formState.employeeId}
          onChange={(event) => setFormState((current) => ({ ...current, employeeId: event.target.value }))}
        >
          <option value="">
            {loadingEmployees ? "Loading employees..." : employees.length ? "Select employee" : "No employees available"}
          </option>
          {visibleEmployees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName} — {employee.title || "No title"} — {employee.employeeRegion || "No region"}
              {assignedEmployeeIds.has(employee.id) ? " — Assigned" : ""}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Project search</span>
        <input
          placeholder="Filter eligible projects"
          value={projectSearch}
          disabled={loadingProjects || !projects.length}
          onChange={(event) => setProjectSearch(event.target.value)}
        />
      </label>
      <label>
        <span>Project</span>
        <select
          disabled={loadingProjects || !projects.length}
          value={formState.projectId}
          onChange={(event) => {
            const nextProject = projects.find((project) => project.id === event.target.value) ?? null;
            setFormState((current) => ({
              ...current,
              projectId: event.target.value,
              clientId: nextProject?.clientId ?? current.clientId
            }));
          }}
        >
          <option value="">{loadingProjects ? "Loading projects..." : projects.length ? "Select project" : "No eligible projects"}</option>
          {visibleProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Client</span>
        <select
          disabled={loadingClients}
          value={formState.clientId}
          onChange={(event) => setFormState((current) => ({ ...current, clientId: event.target.value }))}
        >
          <option value="">{loadingClients ? "Loading clients..." : "Auto / Unassigned"}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.clientName}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Work date</span>
        <input
          type="date"
          value={formState.workDate}
          onChange={(event) => setFormState((current) => ({ ...current, workDate: event.target.value }))}
        />
      </label>

      <div className="form-grid__full quick-action-row">
        <span className="helper-text">Quick dates</span>
        <div className="row-actions">
          <button className="button button--ghost" onClick={() => setFormState((current) => ({ ...current, workDate: todayLabel() }))} type="button">
            Today
          </button>
          <button className="button button--ghost" onClick={() => setFormState((current) => ({ ...current, workDate: shiftedDateLabel(-1) }))} type="button">
            Yesterday
          </button>
        </div>
      </div>

      <label>
        <span>Hours</span>
        <input
          type="number"
          min="0.25"
          max="24"
          step="0.25"
          value={formState.hours}
          onChange={(event) => setFormState((current) => ({ ...current, hours: event.target.value }))}
        />
      </label>
      <label>
        <span>Work category</span>
        <select
          value={formState.workCategory}
          onChange={(event) => setFormState((current) => ({ ...current, workCategory: event.target.value }))}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      <label className="form-grid__full">
        <span>Notes</span>
        <textarea
          className="textarea"
          rows={4}
          value={formState.notes}
          onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
        />
      </label>

      {selectedProject ? (
        <div className="project-context form-grid__full">
          <h4>Selected project context</h4>
          <div className="summary-grid">
            <div>
              <span>Client</span>
              <strong>{selectedProject.clientName || "Unassigned"}</strong>
            </div>
            <div>
              <span>Manager</span>
              <strong>{selectedProject.projectManager || "Missing"}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{selectedProject.projectStatus || "Missing"}</strong>
            </div>
            <div>
              <span>Region</span>
              <strong>{selectedProject.projectRegion || "Missing"}</strong>
            </div>
            <div>
              <span>Start</span>
              <strong>{formatDate(selectedProject.projectStartDate)}</strong>
            </div>
            <div>
              <span>End</span>
              <strong>{formatDate(selectedProject.projectEndDate)}</strong>
            </div>
            <div>
              <span>Budget hours</span>
              <strong>{selectedProject.plannedLoeHours ?? selectedProject.budgetHours ?? "No planned LOE available"}</strong>
            </div>
            <div>
              <span>Sold amount</span>
              <strong>
                {selectedProject.soldAmount == null ? "No sold amount available" : formatMoney(selectedProject.soldAmount)}
              </strong>
            </div>
            <div>
              <span>Tracked hours so far</span>
              <strong>{trackedHoursForProject.toFixed(2)}</strong>
            </div>
            <div>
              <span>Budget remaining</span>
              <strong>
                {remainingHours == null ? "No budget hours available" : remainingHours.toFixed(2)}
              </strong>
            </div>
            <div>
              <span>Percent used</span>
              <strong>{percentUsed == null ? "No budget hours available" : `${percentUsed.toFixed(1)}%`}</strong>
            </div>
            <div>
              <span>Actual cost</span>
              <strong>{selectedProject.actualCost == null ? "Missing cost data" : formatMoney(selectedProject.actualCost)}</strong>
            </div>
            <div>
              <span>Margin</span>
              <strong>{selectedProject.marginPercent == null ? "Missing financial data" : `${selectedProject.marginPercent.toFixed(1)}%`}</strong>
            </div>
            <div>
              <span>Assigned employees</span>
              <strong>{selectedProject.assignedEmployeeCount ?? assignedEmployees.filter((assignment) => assignment.active).length}</strong>
            </div>
            <div>
              <span>Profitability</span>
              <strong>{selectedProject.profitabilityStatus ?? "Unknown"}</strong>
            </div>
          </div>
          {activeAssignedEmployees.length ? (
            <div className="assignment-quick-pick">
              <div className="assignment-quick-pick__header">
                <h5>Assigned team</h5>
                <span>Pick the staffed team member directly from the project roster.</span>
              </div>
              <div className="assignment-chip-grid">
                {activeAssignedEmployees.map((assignment) => (
                  <button
                    key={assignment.id}
                    className={`assignment-chip${formState.employeeId === assignment.employeeId ? " assignment-chip--active" : ""}`}
                    onClick={() => setFormState((current) => ({ ...current, employeeId: assignment.employeeId }))}
                    type="button"
                  >
                    <strong>{assignment.employeeName}</strong>
                    <span>
                      {assignment.roleOnProject || "Unspecified role"}
                      {assignment.allocationPercent != null ? ` • ${assignment.allocationPercent.toFixed(0)}% allocation` : ""}
                      {assignment.plannedHours != null ? ` • ${assignment.plannedHours.toFixed(0)}h planned` : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedProject && !selectedEmployeeAssigned ? (
        <div className="helper-text form-grid__full">
          This employee is not currently assigned to the selected project. You can still save time, but you may want to add a project assignment first.
        </div>
      ) : null}

      {!employees.length && !loadingEmployees ? (
        <div className="helper-text form-grid__full">
          No employees were returned from the API. The page will keep trying fallback employee data from the main Workforce Hub endpoints.
        </div>
      ) : null}
      {!projects.length && !loadingProjects ? (
        <div className="empty-state form-grid__full">
          No eligible projects found. Run the timesheet demo seed or adjust project dates/statuses.
        </div>
      ) : null}
      {!clients.length && !loadingClients ? (
        <div className="helper-text form-grid__full">
          No client options were returned, so the form will default to Auto / Unassigned unless you load client data.
        </div>
      ) : null}

      {error ? <div className="error-text form-grid__full">{error}</div> : null}

      <button
        className="button button--primary"
        disabled={saving || loadingEmployees || loadingProjects || !employees.length || !projects.length}
        type="submit"
      >
        {saving ? "Saving..." : submitLabel}
      </button>
      {selectedProject && isMissing(selectedProject.clientName) ? (
        <div className="helper-text form-grid__full">
          This project does not have a strong client match in the current dataset. You can optionally choose a client manually.
        </div>
      ) : null}
    </form>
  );
}
