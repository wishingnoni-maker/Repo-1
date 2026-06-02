import { safeLower } from "../lib/safe";

interface StatusBadgeProps {
  status: string | null | undefined;
  fallback?: string;
}

const resolveTone = (value: string) => {
  const normalized = safeLower(value);
  if (!normalized) return "neutral";
  if (["active", "execution", "in progress", "open", "current", "ongoing", "started", "approved"].includes(normalized)) {
    return "success";
  }
  if (["close out", "draft", "submitted", "pending"].includes(normalized)) {
    return "warn";
  }
  if (["archived", "complete", "completed", "closed"].includes(normalized)) {
    return "info";
  }
  if (["on hold", "rejected", "missing", "invalid"].includes(normalized)) {
    return "danger";
  }
  return "neutral";
};

export function StatusBadge({ status, fallback = "Missing" }: StatusBadgeProps) {
  const label = status?.trim() || fallback;
  return <span className={`status-badge status-badge--${resolveTone(label)}`}>{label}</span>;
}
