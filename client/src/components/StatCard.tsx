interface StatCardProps {
  label: string;
  value: string | number;
  tone?: "default" | "accent" | "warn";
  onClick?: () => void;
  hint?: string;
}

export function StatCard({ label, value, tone = "default", onClick, hint }: StatCardProps) {
  return (
    <article
      className={`stat-card stat-card--${tone}${onClick ? " stat-card--interactive" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}
