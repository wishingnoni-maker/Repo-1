import { useMemo, useState } from "react";
import type { ProjectAssignment, TimeEntryEmployeeOption } from "../types";

const emptySharedState = {
  roleOnProject: "",
  plannedHours: "",
  billRate: "",
  costRate: "",
  allocationPercent: "",
  startDate: "",
  endDate: "",
  active: true
};

interface BulkProjectAssignmentFormProps {
  employees: TimeEntryEmployeeOption[];
  existingAssignments: ProjectAssignment[];
  onSubmit: (value: {
    employeeIds: string[];
    roleOnProject: string;
    plannedHours: number | null;
    billRate: number | null;
    costRate: number | null;
    allocationPercent: number | null;
    startDate: string | null;
    endDate: string | null;
    active: boolean;
  }) => Promise<void>;
  submitLabel: string;
}

const parseNullableNumber = (value: string) => {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function BulkProjectAssignmentForm({
  employees,
  existingAssignments,
  onSubmit,
  submitLabel
}: BulkProjectAssignmentFormProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formState, setFormState] = useState(emptySharedState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const assignedEmployeeIds = useMemo(
    () => new Set(existingAssignments.filter((assignment) => assignment.active).map((assignment) => assignment.employeeId)),
    [existingAssignments]
  );

  const visibleEmployees = useMemo(
    () =>
      employees.filter((employee) =>
        [employee.fullName, employee.email, employee.title, employee.employeeRegion]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [employees, search]
  );

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!selectedIds.length) {
          setError("Select at least one employee.");
          return;
        }

        const numericValues = [
          ["Planned hours", parseNullableNumber(formState.plannedHours)],
          ["Bill rate", parseNullableNumber(formState.billRate)],
          ["Cost rate", parseNullableNumber(formState.costRate)],
          ["Allocation percent", parseNullableNumber(formState.allocationPercent)]
        ] as const;

        const invalidField = numericValues.find(([, value]) => value !== null && value < 0);
        if (invalidField) {
          setError(`${invalidField[0]} must be zero or greater.`);
          return;
        }
        const allocation = parseNullableNumber(formState.allocationPercent);
        if (allocation != null && allocation > 100) {
          setError("Allocation percent must be between 0 and 100.");
          return;
        }
        if (formState.startDate && formState.endDate && formState.startDate > formState.endDate) {
          setError("Start date must be before or equal to end date.");
          return;
        }

        setSaving(true);
        setError("");
        try {
          await onSubmit({
            employeeIds: selectedIds,
            roleOnProject: formState.roleOnProject.trim(),
            plannedHours: parseNullableNumber(formState.plannedHours),
            billRate: parseNullableNumber(formState.billRate),
            costRate: parseNullableNumber(formState.costRate),
            allocationPercent: parseNullableNumber(formState.allocationPercent),
            startDate: formState.startDate || null,
            endDate: formState.endDate || null,
            active: formState.active
          });
          setSelectedIds([]);
          setFormState(emptySharedState);
          setSearch("");
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Failed to add assignments.");
        } finally {
          setSaving(false);
        }
      }}
    >
      <label className="form-grid__full">
        <span>Filter employees</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, title, region, or email" />
      </label>

      <div className="form-grid__full bulk-assignment-picker">
        {visibleEmployees.map((employee) => {
          const assigned = assignedEmployeeIds.has(employee.id);
          const checked = selectedIds.includes(employee.id);
          return (
            <label key={employee.id} className={`bulk-assignment-option${assigned ? " bulk-assignment-option--assigned" : ""}`}>
              <input
                type="checkbox"
                checked={checked}
                disabled={assigned}
                onChange={(event) =>
                  setSelectedIds((current) =>
                    event.target.checked ? [...current, employee.id] : current.filter((id) => id !== employee.id)
                  )
                }
              />
              <div>
                <strong>{employee.fullName}</strong>
                <span>{employee.title || "No title"} • {employee.employeeRegion || "No region"}</span>
                {assigned ? <small>Already actively assigned</small> : null}
              </div>
            </label>
          );
        })}
        {!visibleEmployees.length ? <div className="hint-box">No employees match the current filter.</div> : null}
      </div>

      {[
        ["roleOnProject", "Role on Project"],
        ["plannedHours", "Planned Hours"],
        ["billRate", "Bill Rate"],
        ["costRate", "Cost Rate"],
        ["allocationPercent", "Allocation %"],
        ["startDate", "Start Date"],
        ["endDate", "End Date"]
      ].map(([field, label]) => (
        <label key={field}>
          <span>{label}</span>
          <input
            type={["plannedHours", "billRate", "costRate", "allocationPercent"].includes(field) ? "number" : field.includes("Date") ? "date" : "text"}
            min={["plannedHours", "billRate", "costRate", "allocationPercent"].includes(field) ? "0" : undefined}
            max={field === "allocationPercent" ? "100" : undefined}
            step={["plannedHours", "billRate", "costRate", "allocationPercent"].includes(field) ? "0.25" : undefined}
            value={String(formState[field as keyof typeof formState] ?? "")}
            onChange={(event) => setFormState((current) => ({ ...current, [field]: event.target.value }))}
          />
        </label>
      ))}

      <label>
        <span>Active assignment</span>
        <select
          value={formState.active ? "true" : "false"}
          onChange={(event) => setFormState((current) => ({ ...current, active: event.target.value === "true" }))}
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </label>

      <div className="form-grid__full row-actions">
        <span className="helper-text">{selectedIds.length} employee{selectedIds.length === 1 ? "" : "s"} selected</span>
      </div>

      {error ? <div className="error-text form-grid__full">{error}</div> : null}

      <button className="button button--primary" disabled={saving || selectedIds.length === 0} type="submit">
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
