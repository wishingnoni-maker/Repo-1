import { isMissing, safeString } from "../lib/safe";
import type { ClientDetailResponse } from "../types";

interface ClientDrawerProps {
  detail: ClientDetailResponse | null;
  onClose: () => void;
}

const MissingBadge = ({ show, text }: { show: boolean; text: string }) =>
  show ? <span className="missing-badge">{text}</span> : null;

export function ClientDrawer({ detail, onClose }: ClientDrawerProps) {
  if (!detail) {
    return null;
  }

  const { client, relatedProjects } = detail;
  const renderValue = (value: unknown) =>
    isMissing(value) ? <span className="missing-badge">Missing</span> : <strong>{safeString(value)}</strong>;

  return (
    <aside className="drawer">
      <div className="drawer__header">
        <div>
          <p className="page-kicker">Client profile</p>
          <h3>{client.clientName}</h3>
          <p>{client.clientStatus || "Status missing"}</p>
        </div>
        <button className="button" onClick={onClose} type="button">
          Close
        </button>
      </div>
      <div className="badge-row">
        <MissingBadge show={!client.clientContact} text="Missing contact" />
        <MissingBadge show={!client.clientDescription} text="Missing description" />
        <MissingBadge show={!client.clientManager} text="Missing manager" />
      </div>
      <div className="profile-card">
        <div><span>Invoice Currency</span>{renderValue(client.clientInvoiceCurrency)}</div>
        <div><span>Contact</span>{renderValue(client.clientContact)}</div>
        <div><span>Manager</span>{renderValue(client.clientManager)}</div>
        <div className="profile-card__wide"><span>Description</span>{renderValue(client.clientDescription)}</div>
      </div>
      <section className="drawer__section">
        <h4>Related projects</h4>
        <ul className="stack-list">
          {relatedProjects.map((project) => (
            <li key={project.id}>
              <strong>{project.projectName}</strong>
              <span>{project.projectStatus || "No status"} • {project.projectManager || "No manager"}</span>
            </li>
          ))}
          {!relatedProjects.length ? <li>No related projects found.</li> : null}
        </ul>
      </section>
    </aside>
  );
}
