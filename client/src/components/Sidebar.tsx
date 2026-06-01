import { NavLink } from "react-router-dom";

const items = [
  { to: "/projects", label: "Projects", shortLabel: "P" },
  { to: "/dashboard", label: "Dashboard", shortLabel: "D" },
  { to: "/employees", label: "Employees", shortLabel: "E" },
  { to: "/import", label: "Import Excel", shortLabel: "I" },
  { to: "/clients", label: "Clients", shortLabel: "C" },
  { to: "/time-tracking", label: "Time Tracking", shortLabel: "T" },
  { to: "/org", label: "Org View", shortLabel: "O" },
  { to: "/data-quality", label: "Data Quality", shortLabel: "Q" },
  { to: "/reports", label: "Reports / Export", shortLabel: "R" },
  { to: "/settings", label: "Settings", shortLabel: "S" }
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`}>
      <div className="sidebar__top">
        <div className={`brand${collapsed ? " brand--collapsed" : ""}`}>
          <span className="brand__mark" aria-hidden="true">WH</span>
          <div className="brand__copy">
            <span className="brand__eyebrow">Internal Tools</span>
            <h1>Workforce Hub</h1>
          </div>
        </div>

        <button
          type="button"
          className="sidebar__toggle"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="sidebar__toggle-icon" aria-hidden="true">{collapsed ? "»" : "«"}</span>
          <span className="sidebar__toggle-label">{collapsed ? "Expand" : "Collapse"}</span>
        </button>
      </div>

      <nav className="nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav__item${isActive ? " nav__item--active" : ""}`}
            title={item.label}
            aria-label={item.label}
          >
            <span className="nav__icon" aria-hidden="true">{item.shortLabel}</span>
            <span className="nav__label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
