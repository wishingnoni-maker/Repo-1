import { useEffect, useState } from "react";
import type { Project } from "../types";

const emptyProject: Partial<Project> = {
  projectName: "",
  projectEstimatedHrs: null,
  projectStatus: "",
  projectCurrency: "",
  projectManager: "",
  projectManagerEmail: "",
  projectStartDate: "",
  projectEndDate: "",
  projectDescription: "",
  budgetHours: null,
  budgetCost: null,
  expenseBudgetProjectCurrency: null,
  projectRegion: "",
  poNumber: "",
  projectSoldBy: "",
  numberOfResources: null,
  numberOfWorkWeeks: null,
  plannedLoeHours: null,
  soldAmount: null,
  blendedBillRate: null,
  blendedCostRate: null,
  profitabilityNotes: ""
};

const numericFields = new Set([
  "projectEstimatedHrs",
  "budgetHours",
  "budgetCost",
  "expenseBudgetProjectCurrency",
  "numberOfResources",
  "numberOfWorkWeeks",
  "plannedLoeHours",
  "soldAmount",
  "blendedBillRate",
  "blendedCostRate"
]);

interface ProjectFormProps {
  initialValue?: Partial<Project>;
  onSubmit: (value: Partial<Project>) => Promise<void>;
  submitLabel: string;
}

export function ProjectForm({ initialValue, onSubmit, submitLabel }: ProjectFormProps) {
  const [formState, setFormState] = useState<Partial<Project>>(initialValue ?? emptyProject);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormState(initialValue ?? emptyProject);
  }, [initialValue]);

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSubmit(formState);
          if (!initialValue?.id) {
            setFormState(emptyProject);
          }
        } finally {
          setSaving(false);
        }
      }}
    >
      {[
        ["projectName", "Project Name"],
        ["projectEstimatedHrs", "Project Estimated Hrs"],
        ["projectStatus", "Project Status"],
        ["projectCurrency", "Project Currency"],
        ["projectManager", "Project Manager"],
        ["projectManagerEmail", "Project Manager Email"],
        ["projectStartDate", "Project Start Date"],
        ["projectEndDate", "Project End Date"],
        ["projectDescription", "Project Description"],
        ["budgetHours", "Budget Hours"],
        ["budgetCost", "Budget Cost"],
        ["expenseBudgetProjectCurrency", "Expense Budget"],
        ["projectRegion", "Project Region"],
        ["poNumber", "PO Number"],
        ["projectSoldBy", "Project Sold By"],
        ["numberOfResources", "Number of Resources"],
        ["numberOfWorkWeeks", "Number of Work Weeks"],
        ["plannedLoeHours", "Planned LOE Hours"],
        ["soldAmount", "Sold Amount"],
        ["blendedBillRate", "Blended Bill Rate"],
        ["blendedCostRate", "Blended Cost Rate"],
        ["profitabilityNotes", "Profitability Notes"]
      ].map(([field, label]) => (
        <label key={field}>
          <span>{label}</span>
          <input
            type={numericFields.has(field) ? "number" : "text"}
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
        </label>
      ))}
      <button className="button button--primary" disabled={saving} type="submit">
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
