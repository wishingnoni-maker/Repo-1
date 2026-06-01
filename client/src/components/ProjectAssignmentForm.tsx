import { useEffect, useState } from "react";
import type { ProjectAssignment, TimeEntryEmployeeOption } from "../types";

const numericFields = new Set(["plannedHours", "billRate", "costRate", "allocationPercent"]);

const emptyState = {
  employeeId: "",
  roleOnProject: "",
  plannedHours: null as number | null,
  billRate: null as number | null,
  costRate: null as number | null,
  allocationPercent: null as number | null,
  startDate: "",
  endDate: "",
  active: true
};

interface ProjectAssignmentFormProps {
  employees: TimeEntryEmployeeOption[];
  initialValue?: Partial<ProjectAssignment>;
  onSubmit: (value: {
    employeeId: string;
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

export function ProjectAssignmentForm({
  employees,
  initialValue,
  onSubmit,
  submitLabel
}: ProjectAssignmentFormProps) {
  const [formState, setFormState] = useState({
    employeeId: initialValue?.employeeId ?? "",
    roleOnProject: initialValue?.roleOnProject ?? "",
    plannedHours: initialValue?.plannedHours ?? null,
    billRate: initialValue?.billRate ?? null,
    costRate: initialValue?.costRate ?? null,
    allocationPercent: initialValue?.allocationPercent ?? null,
    startDate: initialValue?.startDate ?? "",
    endDate: initialValue?.endDate ?? "",
    active: initialValue?.active ?? true
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setFormState({
      employeeId: initialValue?.employeeId ?? "",
      roleOnProject: initialValue?.roleOnProject ?? "",
      plannedHours: initialValue?.plannedHours ?? null,
      billRate: initialValue?.billRate ?? null,
      costRate: initialValue?.costRate ?? null,
      allocationPercent: initialValue?.allocationPercent ?? null,
      startDate: initialValue?.startDate ?? "",
      endDate: initialValue?.endDate ?? "",
      active: initialValue?.active ?? true
    });
    setError("");
  }, [initialValue]);

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!formState.employeeId) {
          setError("Employee is required.");
          return;
        }
        const numericPairs = [
          ["Planned hours", formState.plannedHours],
          ["Bill rate", formState.billRate],
          ["Cost rate", formState.costRate],
          ["Allocation percent", formState.allocationPercent]
        ] as const;
        const negativeValue = numericPairs.find(([, value]) => value != null && value < 0);
        if (negativeValue) {
          setError(`${negativeValue[0]} must be zero or greater.`);
          return;
        }
        if (formState.allocationPercent != null && formState.allocationPercent > 100) {
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
            employeeId: formState.employeeId,
            roleOnProject: formState.roleOnProject,
            plannedHours: formState.plannedHours,
            billRate: formState.billRate,
            costRate: formState.costRate,
            allocationPercent: formState.allocationPercent,
            startDate: formState.startDate || null,
            endDate: formState.endDate || null,
            active: formState.active
          });
          if (!initialValue?.id) {
            setFormState(emptyState);
          }
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Failed to save assignment.");
        } finally {
          setSaving(false);
        }
      }}
    >
      <label>
        <span>Employee</span>
        <select
          value={formState.employeeId}
          onChange={(event) => setFormState((current) => ({ ...current, employeeId: event.target.value }))}
        >
          <option value="">Select employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName} — {employee.title || "No title"}
            </option>
          ))}
        </select>
      </label>
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
            type={numericFields.has(field) ? "number" : field.toLowerCase().includes("date") ? "date" : "text"}
            min={numericFields.has(field) ? "0" : undefined}
            max={field === "allocationPercent" ? "100" : undefined}
            step={numericFields.has(field) ? "0.25" : undefined}
            value={(formState[field as keyof typeof formState] as string | number | null | undefined) ?? ""}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                [field]: numericFields.has(field)
                  ? event.target.value === ""
                    ? null
                    : Number(event.target.value)
                  : event.target.value
              }))
            }
          />
        </label>
      ))}
      <label className="form-grid__full">
        <span>Active assignment</span>
        <select
          value={formState.active ? "true" : "false"}
          onChange={(event) => setFormState((current) => ({ ...current, active: event.target.value === "true" }))}
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </label>
      {error ? <div className="error-text form-grid__full">{error}</div> : null}
      <button className="button button--primary" disabled={saving} type="submit">
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
