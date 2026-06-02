import { useEffect, useMemo, useState } from "react";
import { ClientForm } from "../components/ClientForm";
import { EmployeeForm } from "../components/EmployeeForm";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { ProjectForm } from "../components/ProjectForm";
import { StatCard } from "../components/StatCard";
import { api } from "../lib/api";
import { isMissing, safeLower, safeString } from "../lib/safe";
import type { Client, DataQualityIssue, Employee, Project } from "../types";

type TabKey = "employees" | "clients" | "projects";
type SeverityLevel = "Critical" | "Warning" | "Info";

const phonePattern = /^[+\d()\-\s.]{7,20}$/;

const employeeFilters = {
  search: "",
  region: "",
  country: "",
  title: "",
  supervisor: "",
  titleCode: "",
  hireYear: "",
  page: 1,
  pageSize: 5000,
  sortBy: "name" as const,
  sortDirection: "asc" as const
};

const clientFilters = {
  search: "",
  clientStatus: "",
  clientInvoiceCurrency: "",
  clientManager: "",
  missingContact: false,
  missingDescription: false,
  missingManager: false,
  page: 1,
  pageSize: 5000
};

const projectFilters = {
  search: "",
  manager: "",
  managerEmail: "",
  poNumber: "",
  soldBy: "",
  projectStatus: "",
  projectRegion: "",
  projectCurrency: "",
  missingPoNumber: false,
  missingManager: false,
  missingManagerEmail: false,
  missingStartDate: false,
  missingEndDate: false,
  page: 1,
  pageSize: 5000
};

const issueTypeLabels: Record<string, string> = {
  missing_email: "Missing email",
  duplicate_email: "Duplicate email",
  missing_title: "Missing title",
  missing_supervisor: "Missing supervisor",
  invalid_hire_date: "Invalid hire date",
  missing_region_or_country: "Missing region or country",
  phone_format: "Phone format issue",
  title_code_without_title: "Title code without title",
  supervisor_not_found: "Supervisor not found",
  missing_client_name: "Missing client name",
  duplicate_client_name: "Duplicate client name",
  missing_client_contact: "Missing client contact",
  missing_client_description: "Missing client description",
  missing_client_manager: "Missing client manager",
  missing_client_invoice_currency: "Missing invoice currency",
  missing_project_name: "Missing project name",
  duplicate_project_name: "Duplicate project name",
  missing_project_status: "Missing project status",
  missing_project_currency: "Missing project currency",
  missing_project_manager: "Missing project manager",
  missing_project_manager_email: "Missing project manager email",
  missing_project_po_number: "Missing PO number",
  missing_project_region: "Missing project region",
  missing_project_sold_by: "Missing sold-by person",
  missing_project_description: "Missing project description",
  missing_project_start_date: "Missing start date",
  missing_project_end_date: "Missing end date",
  missing_budget_hours: "Missing budget hours",
  missing_budget_cost: "Missing budget cost",
  missing_expense_budget: "Missing expense budget",
  invalid_project_estimated_hrs: "Invalid estimated hours",
  invalid_number_of_resources: "Invalid number of resources",
  invalid_number_of_work_weeks: "Invalid number of work weeks"
};

const issueDescriptions: Record<string, string> = {
  missing_email: "Employee is missing an email address.",
  duplicate_email: "Employee email appears more than once.",
  missing_title: "Employee is missing a title.",
  missing_supervisor: "Employee does not have a supervisor listed.",
  invalid_hire_date: "Hire date is missing or invalid.",
  missing_region_or_country: "Employee is missing region or country.",
  phone_format: "Employee cell number format looks unusual.",
  title_code_without_title: "Title code exists without a matching title.",
  supervisor_not_found: "Supervisor name does not match any employee in the directory.",
  missing_client_name: "Client is missing a client name.",
  duplicate_client_name: "Client name appears more than once.",
  missing_client_contact: "Client contact is missing.",
  missing_client_description: "Client description is missing.",
  missing_client_manager: "Client manager is missing.",
  missing_client_invoice_currency: "Client invoice currency is missing.",
  missing_project_name: "Project is missing a project name.",
  duplicate_project_name: "Project name appears more than once.",
  missing_project_status: "Project status is missing.",
  missing_project_currency: "Project currency is missing.",
  missing_project_manager: "Project manager is missing.",
  missing_project_manager_email: "Project manager email is missing.",
  missing_project_po_number: "Project PO number is missing.",
  missing_project_region: "Project region is missing.",
  missing_project_sold_by: "Project sold-by person is missing.",
  missing_project_description: "Project description is missing.",
  missing_project_start_date: "Project start date is missing.",
  missing_project_end_date: "Project end date is missing.",
  missing_budget_hours: "Budget hours are missing.",
  missing_budget_cost: "Budget cost is missing.",
  missing_expense_budget: "Expense budget is missing.",
  invalid_project_estimated_hrs: "Project estimated hours are missing or invalid.",
  invalid_number_of_resources: "Number of resources is missing or invalid.",
  invalid_number_of_work_weeks: "Number of work weeks are missing or invalid."
};

interface LocalIssue extends DataQualityIssue {
  severityLabel: SeverityLevel;
}

export function DataQualityPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("employees");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingTarget, setEditingTarget] = useState<
    | { entityType: "employee"; entity: Employee }
    | { entityType: "client"; entity: Client }
    | { entityType: "project"; entity: Project }
    | null
  >(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      api.getEmployees(employeeFilters),
      api.getClients(clientFilters),
      api.getProjects(projectFilters)
    ])
      .then(([employeeResponse, clientResponse, projectResponse]) => {
        setEmployees(employeeResponse.data);
        setClients(clientResponse.data);
        setProjects(projectResponse.data);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Data quality failed to load."))
      .finally(() => setLoading(false));
  }, []);

  const employeeIssues = useMemo(() => buildEmployeeIssues(employees), [employees]);
  const clientIssues = useMemo(() => buildClientIssues(clients), [clients]);
  const projectIssues = useMemo(() => buildProjectIssues(projects), [projects]);

  const tabConfig = {
    employees: {
      title: "Employees",
      description: "Operational warnings and cleanup items detected from employee records.",
      issues: employeeIssues,
      exportHref: api.exportUrl("/export/data-quality")
    },
    clients: {
      title: "Clients",
      description: "Client profile gaps, duplicates, and missing operating metadata.",
      issues: clientIssues,
      exportHref: api.exportUrl("/export/client-data-quality")
    },
    projects: {
      title: "Projects",
      description: "Project metadata, financial, and timeline gaps that need cleanup.",
      issues: projectIssues,
      exportHref: api.exportUrl("/export/project-data-quality")
    }
  } satisfies Record<TabKey, { title: string; description: string; issues: LocalIssue[]; exportHref: string }>;

  const currentTab = tabConfig[activeTab];
  const groups = useMemo(() => groupIssues(currentTab.issues), [currentTab.issues]);
  const kpis = useMemo(() => buildKpis(currentTab.issues), [currentTab.issues]);

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Workforce operations"
        title="Data Quality"
        subtitle="Review missing or inconsistent employee, client, and project data."
        actions={
          <a className="button button--primary" href={currentTab.exportHref}>
            Export CSV
          </a>
        }
      >
        <div className="tabbar">
          {(["employees", "clients", "projects"] as TabKey[]).map((tab) => (
            <button
              key={tab}
              className={`tabbar__item${activeTab === tab ? " tabbar__item--active" : ""}`}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tabConfig[tab].title}
            </button>
          ))}
        </div>
      </PageHeader>

      <section className="stat-grid">
        <StatCard label="Total issues" value={kpis.totalIssues} tone="accent" />
        <StatCard label="Critical" value={kpis.critical} tone="warn" />
        <StatCard label="Warning" value={kpis.warning} />
        <StatCard label="Info" value={kpis.info} />
        <StatCard label="Affected records" value={kpis.affectedRecords} />
        <StatCard label="Issue groups" value={groups.length} />
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>{currentTab.title}</h3>
            <p>{currentTab.description}</p>
          </div>
        </div>

        {loading ? <EmptyState title="Loading data quality..." description="Scanning employees, clients, and projects for issues." tone="loading" compact /> : null}
        {error ? <EmptyState title="Unable to load data quality." description={error} tone="error" compact /> : null}

        {!loading && !error ? (
          <div className="issue-groups">
            {groups.map((group) => (
              <details className="issue-group" key={group.type} open>
                <summary className="issue-group__summary">
                  <div>
                    <strong>{group.label}</strong>
                    <span>{group.items.length} issues</span>
                  </div>
                  <div className="badge-row">
                    <span className={`badge ${severityBadgeClass(group.highestSeverity)}`}>{group.highestSeverity}</span>
                  </div>
                </summary>
                <div className="issue-list">
                  {group.items.map((issue) => (
                    <article className="issue-card issue-card--row" key={`${issue.type}-${issue.entityId}`}>
                      <div className="issue-card__main">
                        <div className="badge-row">
                          <span className={`badge ${severityBadgeClass(issue.severityLabel)}`}>{issue.severityLabel}</span>
                        </div>
                        <strong>{issue.entityName || "Unnamed record"}</strong>
                        <p>{issue.message}</p>
                        {issue.email ? <small>{issue.email}</small> : null}
                      </div>
                      <div className="row-actions">
                        <button
                          className="button button--primary"
                          disabled={!issue.entityId}
                          onClick={() => openFixModal(issue, employees, clients, projects, setEditingTarget)}
                          type="button"
                        >
                          Fix
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </details>
            ))}
            {!groups.length ? <div className="empty-state">No issues detected.</div> : null}
          </div>
        ) : null}
      </section>

      <Modal
        open={Boolean(editingTarget)}
        onClose={() => setEditingTarget(null)}
        title={
          editingTarget?.entityType === "employee"
            ? "Fix employee"
            : editingTarget?.entityType === "client"
              ? "Fix client"
              : "Fix project"
        }
        width={editingTarget?.entityType === "project" ? "wide" : "default"}
      >
        {editingTarget?.entityType === "employee" ? (
          <EmployeeForm
            initialValue={editingTarget.entity}
            onSubmit={async (payload) => {
              const updated = await api.updateEmployee(editingTarget.entity.id, payload);
              setEmployees((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
              setEditingTarget(null);
            }}
            submitLabel="Save employee"
          />
        ) : null}
        {editingTarget?.entityType === "client" ? (
          <ClientForm
            initialValue={editingTarget.entity}
            onSubmit={async (payload) => {
              const updated = await api.updateClient(editingTarget.entity.id, payload);
              setClients((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
              setEditingTarget(null);
            }}
            submitLabel="Save client"
          />
        ) : null}
        {editingTarget?.entityType === "project" ? (
          <ProjectForm
            initialValue={editingTarget.entity}
            onSubmit={async (payload) => {
              const updated = await api.updateProject(editingTarget.entity.id, payload);
              setProjects((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
              setEditingTarget(null);
            }}
            submitLabel="Save project"
          />
        ) : null}
      </Modal>
    </div>
  );
}

const buildEmployeeIssues = (employees: Employee[]): LocalIssue[] => {
  const emailCounts = employees.reduce((map, employee) => {
    const key = safeLower(employee.email);
    if (key) {
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, new Map<string, number>());
  const employeeNameKeys = new Set(employees.map((employee) => normalizeNameKey(employee.fullName)));
  const issues: LocalIssue[] = [];

  employees.forEach((employee) => {
    if (isMissing(employee.email)) {
      issues.push(makeIssue("employee", employee.id, employee.fullName, "missing_email", "Critical", employee.email));
    }
    if (!isMissing(employee.email) && (emailCounts.get(safeLower(employee.email)) ?? 0) > 1) {
      issues.push(makeIssue("employee", employee.id, employee.fullName, "duplicate_email", "Critical", employee.email));
    }
    if (isMissing(employee.title)) {
      issues.push(makeIssue("employee", employee.id, employee.fullName, "missing_title", "Warning"));
    }
    if (isMissing(employee.supervisorName)) {
      issues.push(makeIssue("employee", employee.id, employee.fullName, "missing_supervisor", "Warning"));
    }
    if (isMissing(employee.hireDate)) {
      issues.push(makeIssue("employee", employee.id, employee.fullName, "invalid_hire_date", "Warning"));
    }
    if (isMissing(employee.country) || isMissing(employee.employeeRegion)) {
      issues.push(makeIssue("employee", employee.id, employee.fullName, "missing_region_or_country", "Warning"));
    }
    if (!isMissing(employee.employeeCell) && !phonePattern.test(safeString(employee.employeeCell))) {
      issues.push(makeIssue("employee", employee.id, employee.fullName, "phone_format", "Info"));
    }
    if (!isMissing(employee.titleCode) && isMissing(employee.title)) {
      issues.push(makeIssue("employee", employee.id, employee.fullName, "title_code_without_title", "Info"));
    }
    if (
      !isMissing(employee.supervisorName) &&
      !employeeNameKeys.has(normalizeNameKey(employee.supervisorName))
    ) {
      issues.push(makeIssue("employee", employee.id, employee.fullName, "supervisor_not_found", "Warning"));
    }
  });

  return issues;
};

const buildClientIssues = (clients: Client[]): LocalIssue[] => {
  const nameCounts = clients.reduce((map, client) => {
    const key = normalizeNameKey(client.clientName);
    if (key) {
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, new Map<string, number>());
  const issues: LocalIssue[] = [];

  clients.forEach((client) => {
    if (isMissing(client.clientName)) {
      issues.push(makeIssue("client", client.id, client.clientName || "Unnamed client", "missing_client_name", "Critical"));
    }
    if (!isMissing(client.clientName) && (nameCounts.get(normalizeNameKey(client.clientName)) ?? 0) > 1) {
      issues.push(makeIssue("client", client.id, client.clientName, "duplicate_client_name", "Critical"));
    }
    if (isMissing(client.clientContact)) {
      issues.push(makeIssue("client", client.id, client.clientName, "missing_client_contact", "Warning"));
    }
    if (isMissing(client.clientDescription)) {
      issues.push(makeIssue("client", client.id, client.clientName, "missing_client_description", "Info"));
    }
    if (isMissing(client.clientManager)) {
      issues.push(makeIssue("client", client.id, client.clientName, "missing_client_manager", "Warning"));
    }
    if (isMissing(client.clientInvoiceCurrency)) {
      issues.push(makeIssue("client", client.id, client.clientName, "missing_client_invoice_currency", "Warning"));
    }
  });

  return issues;
};

const buildProjectIssues = (projects: Project[]): LocalIssue[] => {
  const nameCounts = projects.reduce((map, project) => {
    const key = normalizeNameKey(project.projectName);
    if (key) {
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, new Map<string, number>());
  const issues: LocalIssue[] = [];

  projects.forEach((project) => {
    const name = project.projectName || "Unnamed project";
    if (isMissing(project.projectName)) {
      issues.push(makeIssue("project", project.id, name, "missing_project_name", "Critical"));
    }
    if (!isMissing(project.projectName) && (nameCounts.get(normalizeNameKey(project.projectName)) ?? 0) > 1) {
      issues.push(makeIssue("project", project.id, name, "duplicate_project_name", "Critical"));
    }

    const stringChecks: Array<[string, unknown, SeverityLevel]> = [
      ["missing_project_status", project.projectStatus, "Warning"],
      ["missing_project_currency", project.projectCurrency, "Warning"],
      ["missing_project_manager", project.projectManager, "Warning"],
      ["missing_project_manager_email", project.projectManagerEmail, "Warning"],
      ["missing_project_po_number", project.poNumber, "Warning"],
      ["missing_project_region", project.projectRegion, "Warning"],
      ["missing_project_sold_by", project.projectSoldBy, "Info"],
      ["missing_project_description", project.projectDescription, "Info"]
    ];

    stringChecks.forEach(([type, value, severity]) => {
      if (isMissing(value)) {
        issues.push(makeIssue("project", project.id, name, type, severity));
      }
    });

    if (isMissing(project.projectStartDate)) {
      issues.push(makeIssue("project", project.id, name, "missing_project_start_date", "Warning"));
    }
    if (isMissing(project.projectEndDate)) {
      issues.push(makeIssue("project", project.id, name, "missing_project_end_date", "Warning"));
    }
    if (project.budgetHours == null) {
      issues.push(makeIssue("project", project.id, name, "missing_budget_hours", "Warning"));
    }
    if (project.budgetCost == null) {
      issues.push(makeIssue("project", project.id, name, "missing_budget_cost", "Warning"));
    }
    if (project.expenseBudgetProjectCurrency == null) {
      issues.push(makeIssue("project", project.id, name, "missing_expense_budget", "Warning"));
    }
    if (project.projectEstimatedHrs == null) {
      issues.push(makeIssue("project", project.id, name, "invalid_project_estimated_hrs", "Warning"));
    }
    if (project.numberOfResources == null) {
      issues.push(makeIssue("project", project.id, name, "invalid_number_of_resources", "Warning"));
    }
    if (project.numberOfWorkWeeks == null) {
      issues.push(makeIssue("project", project.id, name, "invalid_number_of_work_weeks", "Warning"));
    }
  });

  return issues;
};

const makeIssue = (
  entityType: "employee" | "client" | "project",
  entityId: string,
  entityName: string,
  type: string,
  severityLabel: SeverityLevel,
  email?: string
): LocalIssue => ({
  entityType,
  entityId,
  entityName: safeString(entityName) || "Unnamed record",
  type,
  severity: severityLabel === "Critical" ? "error" : severityLabel === "Warning" ? "warning" : "info",
  severityLabel,
  email: safeString(email) || undefined,
  message: issueDescriptions[type] ?? "Issue detected."
});

const groupIssues = (issues: LocalIssue[]) =>
  [...issues.reduce((map, issue) => {
    const existing = map.get(issue.type) ?? {
      type: issue.type,
      label: issueTypeLabels[issue.type] ?? issue.type,
      items: [] as LocalIssue[],
      highestSeverity: "Info" as SeverityLevel
    };
    existing.items.push(issue);
    existing.highestSeverity = higherSeverity(existing.highestSeverity, issue.severityLabel);
    map.set(issue.type, existing);
    return map;
  }, new Map<string, { type: string; label: string; items: LocalIssue[]; highestSeverity: SeverityLevel }>()).values()].sort(
    (a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label)
  );

const buildKpis = (issues: LocalIssue[]) => ({
  totalIssues: issues.length,
  critical: issues.filter((issue) => issue.severityLabel === "Critical").length,
  warning: issues.filter((issue) => issue.severityLabel === "Warning").length,
  info: issues.filter((issue) => issue.severityLabel === "Info").length,
  affectedRecords: new Set(issues.map((issue) => issue.entityId).filter(Boolean)).size
});

const severityBadgeClass = (severity: SeverityLevel) => {
  switch (severity) {
    case "Critical":
      return "badge--error";
    case "Warning":
      return "badge--warn";
    case "Info":
    default:
      return "badge--info";
  }
};

const higherSeverity = (a: SeverityLevel, b: SeverityLevel): SeverityLevel => {
  const rank: Record<SeverityLevel, number> = { Critical: 3, Warning: 2, Info: 1 };
  return rank[b] > rank[a] ? b : a;
};

const normalizeNameKey = (value: unknown) =>
  safeLower(value).replace(/[^a-z0-9]+/g, " ").trim();

const openFixModal = (
  issue: LocalIssue,
  employees: Employee[],
  clients: Client[],
  projects: Project[],
  setEditingTarget: React.Dispatch<
    React.SetStateAction<
      | { entityType: "employee"; entity: Employee }
      | { entityType: "client"; entity: Client }
      | { entityType: "project"; entity: Project }
      | null
    >
  >
) => {
  if (!issue.entityId) return;
  if (issue.entityType === "employee") {
    const entity = employees.find((item) => item.id === issue.entityId);
    if (entity) setEditingTarget({ entityType: "employee", entity });
    return;
  }
  if (issue.entityType === "client") {
    const entity = clients.find((item) => item.id === issue.entityId);
    if (entity) setEditingTarget({ entityType: "client", entity });
    return;
  }
  const entity = projects.find((item) => item.id === issue.entityId);
  if (entity) setEditingTarget({ entityType: "project", entity });
};
