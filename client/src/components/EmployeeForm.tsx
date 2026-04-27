import { useEffect, useState } from "react";
import type { Employee } from "../types";

const emptyEmployee: Partial<Employee> = {
  firstName: "",
  lastName: "",
  fullName: "",
  email: "",
  title: "",
  employeeRegion: "",
  supervisorName: "",
  employeeCell: "",
  country: "",
  titleCode: "",
  hireDate: ""
};

interface EmployeeFormProps {
  initialValue?: Partial<Employee>;
  onSubmit: (value: Partial<Employee>) => Promise<void>;
  submitLabel: string;
}

export function EmployeeForm({ initialValue, onSubmit, submitLabel }: EmployeeFormProps) {
  const [formState, setFormState] = useState<Partial<Employee>>(initialValue ?? emptyEmployee);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormState(initialValue ?? emptyEmployee);
  }, [initialValue]);

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSubmit(formState);
          if (!initialValue) {
            setFormState(emptyEmployee);
          }
        } finally {
          setSaving(false);
        }
      }}
    >
      {[
        ["firstName", "First name"],
        ["lastName", "Last name"],
        ["fullName", "Full name"],
        ["email", "Email"],
        ["title", "Title"],
        ["employeeRegion", "Region"],
        ["supervisorName", "Supervisor"],
        ["employeeCell", "Cell"],
        ["country", "Country"],
        ["titleCode", "Title code"],
        ["hireDate", "Hire date"]
      ].map(([key, label]) => (
        <label key={key}>
          <span>{label}</span>
          <input
            type={key === "hireDate" ? "date" : "text"}
            value={(formState[key as keyof Employee] as string | undefined) ?? ""}
            onChange={(event) => setFormState((current) => ({ ...current, [key]: event.target.value }))}
          />
        </label>
      ))}
      <button className="button button--primary" disabled={saving} type="submit">
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
