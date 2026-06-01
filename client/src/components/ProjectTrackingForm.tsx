import { useEffect, useState } from "react";
import type { Project } from "../types";

const numericFields = new Set([
  "plannedLoeHours",
  "soldAmount",
  "blendedBillRate",
  "blendedCostRate"
]);

const emptyTrackingState: Partial<Project> = {
  plannedLoeHours: null,
  soldAmount: null,
  blendedBillRate: null,
  blendedCostRate: null,
  projectStartDate: null,
  projectEndDate: null,
  projectStatus: "",
  profitabilityNotes: ""
};

interface ProjectTrackingFormProps {
  initialValue?: Partial<Project>;
  onSubmit: (value: Partial<Project>) => Promise<void>;
  submitLabel: string;
}

export function ProjectTrackingForm({
  initialValue,
  onSubmit,
  submitLabel
}: ProjectTrackingFormProps) {
  const [formState, setFormState] = useState<Partial<Project>>(initialValue ?? emptyTrackingState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setFormState(initialValue ?? emptyTrackingState);
    setError("");
  }, [initialValue]);

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault();
        const numericPairs = [
          ["Planned LOE hours", formState.plannedLoeHours],
          ["Sold amount", formState.soldAmount],
          ["Blended bill rate", formState.blendedBillRate],
          ["Blended cost rate", formState.blendedCostRate]
        ] as const;
        const negativeValue = numericPairs.find(([, value]) => value != null && value < 0);
        if (negativeValue) {
          setError(`${negativeValue[0]} must be zero or greater.`);
          return;
        }
        if (formState.projectStartDate && formState.projectEndDate && formState.projectStartDate > formState.projectEndDate) {
          setError("Project start date must be before or equal to the end date.");
          return;
        }

        setSaving(true);
        setError("");
        try {
          await onSubmit(formState);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Failed to save tracking details.");
        } finally {
          setSaving(false);
        }
      }}
    >
      {[
        ["plannedLoeHours", "Planned LOE Hours"],
        ["soldAmount", "Sold Amount"],
        ["blendedBillRate", "Blended Bill Rate"],
        ["blendedCostRate", "Blended Cost Rate"],
        ["projectStartDate", "Project Start Date"],
        ["projectEndDate", "Project End Date"],
        ["projectStatus", "Project Status"],
        ["profitabilityNotes", "Profitability Notes"]
      ].map(([field, label]) => (
        <label key={field}>
          <span>{label}</span>
          {field === "profitabilityNotes" ? (
            <textarea
              className="textarea"
              rows={4}
              value={(formState[field as keyof Project] as string | number | null | undefined) ?? ""}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  [field]: event.target.value
                }))
              }
            />
          ) : (
            <input
              type={
                numericFields.has(field)
                  ? "number"
                  : field === "projectStartDate" || field === "projectEndDate"
                    ? "date"
                    : "text"
              }
              min={numericFields.has(field) ? "0" : undefined}
              step={numericFields.has(field) ? "0.25" : undefined}
              value={(formState[field as keyof Project] as string | number | null | undefined) ?? ""}
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
          )}
        </label>
      ))}
      {error ? <div className="error-text form-grid__full">{error}</div> : null}
      <button className="button button--primary" disabled={saving} type="submit">
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
