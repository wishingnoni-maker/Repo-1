import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "default" | "error" | "loading" | "warning";
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  action,
  tone = "default",
  compact = false
}: EmptyStateProps) {
  return (
    <div className={`empty-state-card empty-state-card--${tone}${compact ? " empty-state-card--compact" : ""}`}>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-state-card__action">{action}</div> : null}
    </div>
  );
}
