import { useEffect, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { api } from "../lib/api";
import type { SystemStatusResponse } from "../types";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  "http://localhost:4000/api";

const sidebarPreference =
  typeof window !== "undefined" && window.localStorage.getItem("workforceHub.sidebarCollapsed") === "true";

export function SettingsPage() {
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .getSystemStatus()
      .then(setStatus)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Failed to load system status."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Workforce operations"
        title="Settings"
        subtitle="Review environment status, UI preferences, and app information."
      />

      {loading ? (
        <EmptyState title="Loading settings..." description="Checking frontend and API status." tone="loading" />
      ) : null}

      {error ? <EmptyState title="Unable to load settings." description={error} tone="error" /> : null}

      {!loading && !error ? (
        <>
          <section className="panel">
            <div className="panel__header">
              <div>
                <h3>App environment</h3>
                <p>Safe runtime details pulled from the live API status endpoint.</p>
              </div>
            </div>
            <div className="profile-card">
              <div>
                <span>API base URL</span>
                <strong>{apiBaseUrl}</strong>
              </div>
              <div>
                <span>Data provider</span>
                <StatusBadge status={status?.dataProvider} fallback="Unknown" />
              </div>
              <div>
                <span>Backend health</span>
                <StatusBadge status={status?.ok ? "active" : "missing"} fallback="Unknown" />
              </div>
              <div>
                <span>Postgres connection</span>
                <StatusBadge
                  status={status?.postgresConnected ? "approved" : status?.postgresError ? "rejected" : "draft"}
                  fallback="Unknown"
                />
              </div>
              <div>
                <span>Employees / Clients / Projects</span>
                <strong>
                  {status?.counts.employees ?? "—"} / {status?.counts.clients ?? "—"} / {status?.counts.projects ?? "—"}
                </strong>
              </div>
              <div>
                <span>Database SSL</span>
                <strong>{status?.databaseSsl ? "Enabled" : "Disabled"}</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <h3>UI preferences</h3>
                <p>Quick notes about the current shell behavior and browsing density.</p>
              </div>
            </div>
            <div className="profile-card">
              <div>
                <span>Sidebar state</span>
                <strong>{sidebarPreference ? "Collapsed" : "Expanded"}</strong>
              </div>
              <div>
                <span>Table density</span>
                <strong>Compact default</strong>
              </div>
              <div>
                <span>Body horizontal scroll</span>
                <strong>Prevented globally</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <h3>About</h3>
                <p>Operational context for the current frontend shell.</p>
              </div>
            </div>
            <div className="settings-copy">
              <p><strong>Workforce Hub</strong> is tuned for internal workforce, client, project, and weekly timesheet operations.</p>
              <p>The current frontend keeps Neon/Postgres as the source of truth through the existing backend APIs. No secrets are shown here.</p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
