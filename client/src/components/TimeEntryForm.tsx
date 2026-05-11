import { useEffect, useMemo, useState } from "react";
import { formatDate } from "../lib/format";
import { formatMoney, isMissing, safeString } from "../lib/safe";
import type { Client, TimeEntry, TimeEntryEmployeeOption, TimeEntryProjectOption } from "../types";

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

  const visibleEmployees = useMemo(
    () =>
      employees.filter((employee) =>
        [employee.fullName, employee.email, employee.title, employee.employeeRegion]
          .join(" ")
          .toLowerCase()
          .includes(employeeSearch.toLowerCase())
      ),
    [employeeSearch, employees]
  );

  const visibleProjects = useMemo(
    () =>
      projects.filter((project) => project.label.toLowerCase().includes(projectSearch.toLowerCase())),
    [projectSearch, projects]
  );

  const selectedProject = projects.find((project) => project.id === formState.projectId) ?? null;
  const trackedHoursForProject = selectedProject ? trackedHoursByProject[selectedProject.id] ?? 0 : 0;
  const remainingHours =
    selectedProject?.budgetHours == null ? null : Number((selectedProject.budgetHours - trackedHoursForProject).toFixed(2));
  const percentUsed =
    selectedProject?.budgetHours && selectedProject.budgetHours > 0
      ? Number(((trackedHoursForProject / selectedProject.budgetHours) * 100).toFixed(1))
      : null;

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
              <strong>{selectedProject.budgetHours ?? "No budget hours available"}</strong>
            </div>
            <div>
              <span>Budget cost</span>
              <strong>
                {selectedProject.budgetCost == null ? "No budget cost available" : formatMoney(selectedProject.budgetCost)}
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
          </div>
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
