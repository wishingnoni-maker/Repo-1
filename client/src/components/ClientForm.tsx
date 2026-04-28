import { useEffect, useState } from "react";
import type { Client } from "../types";

const emptyClient: Partial<Client> = {
  clientName: "",
  clientStatus: "",
  clientInvoiceCurrency: "",
  clientContact: "",
  clientDescription: "",
  clientManager: ""
};

interface ClientFormProps {
  initialValue?: Partial<Client>;
  onSubmit: (value: Partial<Client>) => Promise<void>;
  submitLabel: string;
}

export function ClientForm({ initialValue, onSubmit, submitLabel }: ClientFormProps) {
  const [formState, setFormState] = useState<Partial<Client>>(initialValue ?? emptyClient);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormState(initialValue ?? emptyClient);
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
            setFormState(emptyClient);
          }
        } finally {
          setSaving(false);
        }
      }}
    >
      {[
        ["clientName", "Client Name"],
        ["clientStatus", "Client Status"],
        ["clientInvoiceCurrency", "Invoice Currency"],
        ["clientContact", "Client Contact"],
        ["clientManager", "Client Manager"],
        ["clientDescription", "Client Description"]
      ].map(([field, label]) => (
        <label key={field}>
          <span>{label}</span>
          <input
            value={(formState[field as keyof Client] as string | undefined) ?? ""}
            onChange={(event) => setFormState((current) => ({ ...current, [field]: event.target.value }))}
          />
        </label>
      ))}
      <button className="button button--primary" disabled={saving} type="submit">
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
