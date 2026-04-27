import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { OrgGroup } from "../types";

export function OrgViewPage() {
  const [groups, setGroups] = useState<OrgGroup[]>([]);
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");

  useEffect(() => {
    api.getOrgGroups(region, country).then(setGroups).catch(console.error);
  }, [region, country]);

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Organization view</h3>
            <p>Supervisor groups are preserved even when the supervisor name is not an employee match.</p>
          </div>
        </div>
        <div className="filters">
          <input placeholder="Filter region" value={region} onChange={(event) => setRegion(event.target.value)} />
          <input placeholder="Filter country" value={country} onChange={(event) => setCountry(event.target.value)} />
        </div>
      </section>

      <section className="org-grid">
        {groups.map((group) => (
          <article className="org-card" key={group.supervisorName}>
            <div className="org-card__header">
              <div>
                <h4>{group.supervisorName}</h4>
                <p>
                  {group.region || "Unknown region"} • {group.country || "Unknown country"}
                </p>
              </div>
              <span className={`badge ${group.supervisorExists ? "badge--ok" : "badge--warn"}`}>
                {group.supervisorExists ? "Matched supervisor" : "Supervisor missing"}
              </span>
            </div>
            <ul className="stack-list">
              {group.reports.map((report) => (
                <li key={report.id}>
                  <strong>{report.fullName}</strong>
                  <span>{report.title || "No title"}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
