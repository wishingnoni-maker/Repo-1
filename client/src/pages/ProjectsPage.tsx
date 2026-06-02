import React, { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "../components/ChartCard";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DetailDrawer } from "../components/DetailDrawer";
import { EmptyState } from "../components/EmptyState";
import { MissingDataChips } from "../components/MissingDataChips";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { ProjectDrawer } from "../components/ProjectDrawer";
import { ProjectForm } from "../components/ProjectForm";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/ToastProvider";
import { api } from "../lib/api";
import { cleanNumber, formatMoney, isMissing, safeDateLabel, safeLower, safeString } from "../lib/safe";
import type { Project, ProjectDetailResponse, ProjectFilters } from "../types";

const tabs = ["Overview", "Directory", "Financials / Hours", "Details / Metadata", "Missing Data"] as const;
type ProjectTab = (typeof tabs)[number];

const defaultFilters: ProjectFilters = {
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
  pageSize: 25
};

const getField = (row: Record<string, unknown>, names: string[]) => {
  const normalizedEntries = Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[safeLower(key)] = value;
    return acc;
  }, {});

  for (const name of names) {
    const value = normalizedEntries[safeLower(name)];
    if (value !== undefined) {
      return value;
    }
  }

  return "";
};

const normalizeProject = (row: Record<string, unknown>, index: number): Project => ({
  id: safeString(row.id) || `project-${index}`,
  projectName: safeString(getField(row, ["Project Name", "projectName"])),
  projectEstimatedHrs: isMissing(getField(row, ["Project Estimated Hrs", "projectEstimatedHrs"]))
    ? null
    : cleanNumber(getField(row, ["Project Estimated Hrs", "projectEstimatedHrs"])),
  projectStatus: safeString(getField(row, ["Project Status", "projectStatus"])),
  projectCurrency: safeString(getField(row, ["Project Currency", "projectCurrency"])),
  projectManager: safeString(getField(row, ["Project Manager", "projectManager"])),
  projectManagerEmail: safeString(getField(row, ["Project Manager Email", "projectManagerEmail"])),
  projectStartDate: safeString(getField(row, ["Project Start Date", "projectStartDate"])) || null,
  projectEndDate: safeString(getField(row, ["Project End Date", "projectEndDate"])) || null,
  projectDescription: safeString(getField(row, ["Project Description", "projectDescription"])),
  budgetHours: isMissing(getField(row, ["Budget Hours", "budgetHours"]))
    ? null
    : cleanNumber(getField(row, ["Budget Hours", "budgetHours"])),
  budgetCost: isMissing(getField(row, ["Budget Cost", "budgetCost"]))
    ? null
    : cleanNumber(getField(row, ["Budget Cost", "budgetCost"])),
  expenseBudgetProjectCurrency: isMissing(
    getField(row, ["Expense Budget (Project Currency)", "expenseBudgetProjectCurrency"])
  )
    ? null
    : cleanNumber(getField(row, ["Expense Budget (Project Currency)", "expenseBudgetProjectCurrency"])),
  projectRegion: safeString(getField(row, ["Project Region", "projectRegion"])),
  poNumber: safeString(getField(row, ["PO Number", "poNumber"])),
  projectSoldBy: safeString(getField(row, ["Project Sold By", "projectSoldBy"])),
  numberOfResources: isMissing(getField(row, ["Number of Resources", "numberOfResources"]))
    ? null
    : cleanNumber(getField(row, ["Number of Resources", "numberOfResources"])),
  numberOfWorkWeeks: isMissing(getField(row, ["Number of Work Weeks", "numberOfWorkWeeks"]))
    ? null
    : cleanNumber(getField(row, ["Number of Work Weeks", "numberOfWorkWeeks"])),
  plannedLoeHours: isMissing(getField(row, ["Planned LOE Hours", "plannedLoeHours", "Budget Hours", "budgetHours"]))
    ? null
    : cleanNumber(getField(row, ["Planned LOE Hours", "plannedLoeHours", "Budget Hours", "budgetHours"])),
  soldAmount: isMissing(getField(row, ["Sold Amount", "soldAmount", "Budget Cost", "budgetCost"]))
    ? null
    : cleanNumber(getField(row, ["Sold Amount", "soldAmount", "Budget Cost", "budgetCost"])),
  blendedBillRate: isMissing(getField(row, ["Blended Bill Rate", "blendedBillRate"]))
    ? null
    : cleanNumber(getField(row, ["Blended Bill Rate", "blendedBillRate"])),
  blendedCostRate: isMissing(getField(row, ["Blended Cost Rate", "blendedCostRate"]))
    ? null
    : cleanNumber(getField(row, ["Blended Cost Rate", "blendedCostRate"])),
  profitabilityNotes: safeString(getField(row, ["Profitability Notes", "profitabilityNotes"])),
  createdAt: safeString(row.createdAt),
  updatedAt: safeString(row.updatedAt)
});

const paginate = <T,>(items: T[], page: number, pageSize: number) =>
  items.slice((page - 1) * pageSize, page * pageSize);

class ProjectsErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page-grid">
          <section className="panel">
            <h3>Projects page failed to load.</h3>
            {import.meta.env.DEV ? <p>{this.state.error.message}</p> : null}
          </section>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ProjectsPage({
  refreshToken,
  onDataChange
}: {
  refreshToken: number;
  onDataChange: () => void;
}) {
  return (
    <ProjectsErrorBoundary>
      <ProjectsPageContent refreshToken={refreshToken} onDataChange={onDataChange} />
    </ProjectsErrorBoundary>
  );
}

function ProjectsPageContent({
  refreshToken,
  onDataChange
}: {
  refreshToken: number;
  onDataChange: () => void;
}) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ProjectTab>("Overview");
  const [filters, setFilters] = useState<ProjectFilters>(defaultFilters);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
  const [editTarget, setEditTarget] = useState<Partial<Project> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tabPages, setTabPages] = useState<Record<ProjectTab, number>>({
    Overview: 1,
    Directory: 1,
    "Financials / Hours": 1,
    "Details / Metadata": 1,
    "Missing Data": 1
  });

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .getProjects({ ...defaultFilters, page: 1, pageSize: 5000 })
      .then((result) => {
        const normalized = result.data.map((row, index) =>
          normalizeProject(row as unknown as Record<string, unknown>, index)
        );
        setAllProjects(normalized);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Projects failed to load."))
      .finally(() => setLoading(false));
  }, [refreshToken]);

  const filteredProjects = useMemo(() => {
    const search = safeLower(filters.search);
    const managerEmail = safeLower(filters.managerEmail);
    const poNumber = safeLower(filters.poNumber);

    return allProjects.filter((project) => {
      const haystack = safeLower(
        [
          project.projectName,
          project.projectManager,
          project.projectManagerEmail,
          project.poNumber,
          project.projectSoldBy
        ].join(" ")
      );
      if (search && !haystack.includes(search)) return false;
      if (filters.manager && safeString(project.projectManager) !== filters.manager) return false;
      if (managerEmail && !safeLower(project.projectManagerEmail).includes(managerEmail)) return false;
      if (poNumber && !safeLower(project.poNumber).includes(poNumber)) return false;
      if (filters.soldBy && safeString(project.projectSoldBy) !== filters.soldBy) return false;
      if (filters.projectStatus && safeString(project.projectStatus) !== filters.projectStatus) return false;
      if (filters.projectRegion && safeString(project.projectRegion) !== filters.projectRegion) return false;
      if (filters.projectCurrency && safeString(project.projectCurrency) !== filters.projectCurrency) return false;
      if (filters.missingPoNumber && !isMissing(project.poNumber)) return false;
      if (filters.missingManager && !isMissing(project.projectManager)) return false;
      if (filters.missingManagerEmail && !isMissing(project.projectManagerEmail)) return false;
      if (filters.missingStartDate && !isMissing(project.projectStartDate)) return false;
      if (filters.missingEndDate && !isMissing(project.projectEndDate)) return false;
      return true;
    });
  }, [allProjects, filters]);

  const missingDataProjects = useMemo(
    () =>
      filteredProjects.filter(
        (project) =>
          isMissing(project.poNumber) ||
          isMissing(project.projectManager) ||
          isMissing(project.projectManagerEmail) ||
          isMissing(project.projectRegion) ||
          project.budgetCost == null ||
          isMissing(project.projectDescription) ||
          isMissing(project.projectStartDate) ||
          isMissing(project.projectEndDate)
      ),
    [filteredProjects]
  );

  const filterOptions = useMemo(
    () => ({
      statuses: uniqueStringValues(allProjects.map((project) => project.projectStatus)),
      regions: uniqueStringValues(allProjects.map((project) => project.projectRegion)),
      managers: uniqueStringValues(allProjects.map((project) => project.projectManager)),
      currencies: uniqueStringValues(allProjects.map((project) => project.projectCurrency)),
      soldBy: uniqueStringValues(allProjects.map((project) => project.projectSoldBy))
    }),
    [allProjects]
  );

  const overview = useMemo(() => {
    const byStatus = groupCounts(allProjects.map((project) => project.projectStatus));
    const byRegion = groupCounts(allProjects.map((project) => project.projectRegion));
    const budgetByRegion = groupSums(allProjects, "projectRegion", "budgetCost");
    return {
      totalProjects: allProjects.length,
      activeProjects: allProjects.filter((project) => safeLower(project.projectStatus) === "active").length,
      closeOutProjects: allProjects.filter((project) => safeLower(project.projectStatus) === "close out").length,
      missingPoNumber: allProjects.filter((project) => isMissing(project.poNumber)).length,
      missingManager: allProjects.filter((project) => isMissing(project.projectManager)).length,
      missingManagerEmail: allProjects.filter((project) => isMissing(project.projectManagerEmail)).length,
      totalBudgetCost: allProjects.reduce((sum, project) => sum + (project.budgetCost ?? 0), 0),
      totalEstimatedHours: allProjects.reduce((sum, project) => sum + (project.projectEstimatedHrs ?? 0), 0),
      totalBudgetHours: allProjects.reduce((sum, project) => sum + (project.budgetHours ?? 0), 0),
      totalExpenseBudget: allProjects.reduce(
        (sum, project) => sum + (project.expenseBudgetProjectCurrency ?? 0),
        0
      ),
      regionsTracked: byRegion.length,
      currenciesTracked: filterOptions.currencies.length,
      byStatus,
      byRegion,
      budgetByRegion,
      missingData: [
        { label: "Missing PO Number", value: allProjects.filter((project) => isMissing(project.poNumber)).length },
        { label: "Missing Manager", value: allProjects.filter((project) => isMissing(project.projectManager)).length },
        {
          label: "Missing Manager Email",
          value: allProjects.filter((project) => isMissing(project.projectManagerEmail)).length
        },
        {
          label: "Missing Description",
          value: allProjects.filter((project) => isMissing(project.projectDescription)).length
        }
      ]
    };
  }, [allProjects, filterOptions.currencies.length]);

  const totalPagesFor = (items: Project[]) => Math.max(1, Math.ceil(items.length / filters.pageSize));
  const currentPageFor = (tab: ProjectTab, items: Project[]) => Math.min(tabPages[tab], totalPagesFor(items));
  const currentDirectoryPage = currentPageFor("Directory", filteredProjects);
  const currentFinancialPage = currentPageFor("Financials / Hours", filteredProjects);
  const currentDetailsPage = currentPageFor("Details / Metadata", filteredProjects);
  const currentMissingPage = currentPageFor("Missing Data", missingDataProjects);

  const directoryProjects = paginate(filteredProjects, currentDirectoryPage, filters.pageSize);
  const financialProjects = paginate(filteredProjects, currentFinancialPage, filters.pageSize);
  const detailProjects = paginate(filteredProjects, currentDetailsPage, filters.pageSize);
  const missingProjects = paginate(missingDataProjects, currentMissingPage, filters.pageSize);

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Workforce operations"
        title="Projects"
        subtitle="Track project status, managers, budgets, timelines, and operational data."
        actions={
          <>
            <button
              className="button"
              onClick={() => {
                setFilters(defaultFilters);
                resetTabPages(setTabPages);
              }}
              type="button"
            >
              Clear filters
            </button>
            <button className="button button--primary" onClick={() => setEditTarget({})} type="button">
              New project
            </button>
          </>
        }
      >
        <div className="tabbar">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`tabbar__item${activeTab === tab ? " tabbar__item--active" : ""}`}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </PageHeader>

      {activeTab === "Overview" ? (
        <>
          <section className="stat-grid">
            <StatCard label="Total projects" value={overview.totalProjects} tone="accent" />
            <StatCard label="Active projects" value={overview.activeProjects} />
            <StatCard label="Close Out projects" value={overview.closeOutProjects} />
            <StatCard label="Missing PO number" value={overview.missingPoNumber} tone="warn" />
            <StatCard label="Missing manager" value={overview.missingManager} tone="warn" />
            <StatCard label="Missing manager email" value={overview.missingManagerEmail} tone="warn" />
            <StatCard label="Total budget cost" value={formatCompactMoney(overview.totalBudgetCost)} />
            <StatCard label="Total estimated hours" value={overview.totalEstimatedHours.toLocaleString()} />
            <StatCard label="Total budget hours" value={overview.totalBudgetHours.toLocaleString()} />
            <StatCard label="Total expense budget" value={formatCompactMoney(overview.totalExpenseBudget)} />
            <StatCard label="Regions tracked" value={overview.regionsTracked} />
            <StatCard label="Currencies tracked" value={overview.currenciesTracked} />
          </section>
          <section className="page-grid page-grid--two">
            <ChartCard title="Projects by status">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={overview.byStatus.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0f766e" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Projects by region">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={overview.byRegion.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Budget cost by region">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={overview.budgetByRegion.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatMoney(value)} />
                  <Bar dataKey="value" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Projects missing data">
              <ul className="stack-list">
                {overview.missingData.map((item) => (
                  <li key={item.label}>
                    <strong>{item.label}</strong>
                    <span>{item.value} projects</span>
                  </li>
                ))}
              </ul>
            </ChartCard>
          </section>
        </>
      ) : null}

      {activeTab !== "Overview" ? (
        <section className="panel">
          <div className="table-toolbar__filters filters">
            <input
              placeholder="Search by project name"
              value={filters.search}
              onChange={(event) => {
                setFilters((current) => ({ ...current, search: event.target.value, page: 1 }));
                resetTabPages(setTabPages);
              }}
            />
            <input
              placeholder="Manager email contains"
              value={filters.managerEmail}
              onChange={(event) => {
                setFilters((current) => ({ ...current, managerEmail: event.target.value, page: 1 }));
                resetTabPages(setTabPages);
              }}
            />
            <input
              placeholder="PO number contains"
              value={filters.poNumber}
              onChange={(event) => {
                setFilters((current) => ({ ...current, poNumber: event.target.value, page: 1 }));
                resetTabPages(setTabPages);
              }}
            />
            <select
              value={filters.projectStatus}
              onChange={(event) => {
                setFilters((current) => ({ ...current, projectStatus: event.target.value, page: 1 }));
                resetTabPages(setTabPages);
              }}
            >
              <option value="">All statuses</option>
              {filterOptions.statuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={filters.projectRegion}
              onChange={(event) => {
                setFilters((current) => ({ ...current, projectRegion: event.target.value, page: 1 }));
                resetTabPages(setTabPages);
              }}
            >
              <option value="">All regions</option>
              {filterOptions.regions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={filters.manager}
              onChange={(event) => {
                setFilters((current) => ({ ...current, manager: event.target.value, page: 1 }));
                resetTabPages(setTabPages);
              }}
            >
              <option value="">All managers</option>
              {filterOptions.managers.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={filters.projectCurrency}
              onChange={(event) => {
                setFilters((current) => ({ ...current, projectCurrency: event.target.value, page: 1 }));
                resetTabPages(setTabPages);
              }}
            >
              <option value="">All currencies</option>
              {filterOptions.currencies.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              value={filters.soldBy}
              onChange={(event) => {
                setFilters((current) => ({ ...current, soldBy: event.target.value, page: 1 }));
                resetTabPages(setTabPages);
              }}
            >
              <option value="">All sold-by</option>
              {filterOptions.soldBy.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <label className="toggle">
              <input
                checked={filters.missingPoNumber}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, missingPoNumber: event.target.checked, page: 1 }));
                  resetTabPages(setTabPages);
                }}
                type="checkbox"
              />
              <span>Missing PO</span>
            </label>
            <label className="toggle">
              <input
                checked={filters.missingManager}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, missingManager: event.target.checked, page: 1 }));
                  resetTabPages(setTabPages);
                }}
                type="checkbox"
              />
              <span>Missing manager</span>
            </label>
            <label className="toggle">
              <input
                checked={filters.missingManagerEmail}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, missingManagerEmail: event.target.checked, page: 1 }));
                  resetTabPages(setTabPages);
                }}
                type="checkbox"
              />
              <span>Missing manager email</span>
            </label>
            <label className="toggle">
              <input
                checked={filters.missingStartDate}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, missingStartDate: event.target.checked, page: 1 }));
                  resetTabPages(setTabPages);
                }}
                type="checkbox"
              />
              <span>Missing start date</span>
            </label>
            <label className="toggle">
              <input
                checked={filters.missingEndDate}
                onChange={(event) => {
                  setFilters((current) => ({ ...current, missingEndDate: event.target.checked, page: 1 }));
                  resetTabPages(setTabPages);
                }}
                type="checkbox"
              />
              <span>Missing end date</span>
            </label>
            <select
              value={filters.pageSize}
              onChange={(event) => {
                const pageSize = Number(event.target.value);
                setFilters((current) => ({ ...current, pageSize, page: 1 }));
                resetTabPages(setTabPages);
              }}
            >
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </select>
          </div>
        </section>
      ) : null}

      {activeTab === "Directory" ? (
        <ProjectTable
          rows={directoryProjects}
          total={filteredProjects.length}
          page={currentDirectoryPage}
          totalPages={totalPagesFor(filteredProjects)}
          onPageChange={(page) => setTabPages((prev) => ({ ...prev, Directory: page }))}
          onView={(project) => setDetail({ project })}
          onEdit={setEditTarget}
          onDelete={setDeleteTarget}
          columns="directory"
        />
      ) : null}

      {activeTab === "Financials / Hours" ? (
        <ProjectTable
          rows={financialProjects}
          total={filteredProjects.length}
          page={currentFinancialPage}
          totalPages={totalPagesFor(filteredProjects)}
          onPageChange={(page) => setTabPages((prev) => ({ ...prev, "Financials / Hours": page }))}
          onView={(project) => setDetail({ project })}
          onEdit={setEditTarget}
          onDelete={setDeleteTarget}
          columns="financials"
        />
      ) : null}

      {activeTab === "Details / Metadata" ? (
        <ProjectTable
          rows={detailProjects}
          total={filteredProjects.length}
          page={currentDetailsPage}
          totalPages={totalPagesFor(filteredProjects)}
          onPageChange={(page) => setTabPages((prev) => ({ ...prev, "Details / Metadata": page }))}
          onView={(project) => setDetail({ project })}
          onEdit={setEditTarget}
          onDelete={setDeleteTarget}
          columns="metadata"
        />
      ) : null}

      {activeTab === "Missing Data" ? (
        <ProjectTable
          rows={missingProjects}
          total={missingDataProjects.length}
          page={currentMissingPage}
          totalPages={totalPagesFor(missingDataProjects)}
          onPageChange={(page) => setTabPages((prev) => ({ ...prev, "Missing Data": page }))}
          onView={(project) => setDetail({ project })}
          onEdit={setEditTarget}
          onDelete={setDeleteTarget}
          columns="missing"
        />
      ) : null}

      {loading ? <EmptyState title="Loading projects..." description="Pulling the latest portfolio data." tone="loading" /> : null}
      {error ? <EmptyState title="Unable to load projects." description={error} tone="error" /> : null}

      <DetailDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.project.projectName ?? "Project details"}
        subtitle={detail?.project.projectStatus || "Project profile"}
      >
        <ProjectDrawer detail={detail} onClose={() => setDetail(null)} embedded />
      </DetailDrawer>

      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={editTarget?.id ? "Edit project" : "Create project"}
        width="wide"
      >
        <ProjectForm
          initialValue={editTarget ?? undefined}
          onSubmit={async (payload) => {
            if (editTarget?.id) {
              const updated = normalizeProject(
                (await api.updateProject(editTarget.id, payload)) as unknown as Record<string, unknown>,
                0
              );
              setAllProjects((prev) => prev.map((project) => (project.id === updated.id ? updated : project)));
              if (detail?.project.id === updated.id) {
                setDetail({ project: updated });
              }
              showToast({ tone: "success", title: "Project updated", description: `${updated.projectName} was saved.` });
            } else {
              const created = normalizeProject(
                (await api.createProject(payload)) as unknown as Record<string, unknown>,
                0
              );
              setAllProjects((prev) => [created, ...prev]);
              showToast({ tone: "success", title: "Project created", description: `${created.projectName} was added.` });
            }
            setEditTarget(null);
            onDataChange();
          }}
          submitLabel={editTarget?.id ? "Save changes" : "Create project"}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.deleteProject(deleteTarget.id);
          setAllProjects((prev) => prev.filter((project) => project.id !== deleteTarget.id));
          if (detail?.project.id === deleteTarget.id) {
            setDetail(null);
          }
          onDataChange();
          showToast({ tone: "success", title: "Project deleted", description: `${deleteTarget.projectName} was removed.` });
        }}
        title="Delete project"
        message={`Are you sure you want to delete ${deleteTarget?.projectName ?? "this project"}?`}
      />
    </div>
  );
}

function ProjectTable({
  rows,
  total,
  page,
  totalPages,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  columns
}: {
  rows: Project[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onView: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  columns: "directory" | "financials" | "metadata" | "missing";
}) {
  return (
    <section className="panel">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            {columns === "directory" ? (
              <tr>
                <th>Project Name</th>
                <th>Status</th>
                <th>Region</th>
                <th>Project Manager</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>PO Number</th>
                <th>Budget Cost</th>
                <th>Actions</th>
              </tr>
            ) : null}
            {columns === "financials" ? (
              <tr>
                <th>Project Name</th>
                <th>Project Currency</th>
                <th>Project Estimated Hrs</th>
                <th>Budget Hours</th>
                <th>Budget Cost</th>
                <th>Expense Budget</th>
                <th>Number of Resources</th>
                <th>Number of Work Weeks</th>
                <th>Actions</th>
              </tr>
            ) : null}
            {columns === "metadata" ? (
              <tr>
                <th>Project Name</th>
                <th>Project Manager Email</th>
                <th>Project Sold By</th>
                <th>Project Description</th>
                <th>Project Start Date</th>
                <th>Project End Date</th>
                <th>PO Number</th>
                <th>Actions</th>
              </tr>
            ) : null}
            {columns === "missing" ? (
              <tr>
                <th>Project Name</th>
                <th>Missing PO</th>
                <th>Missing Manager</th>
                <th>Missing Manager Email</th>
                <th>Missing Region</th>
                <th>Missing Budget Cost</th>
                <th>Missing Description</th>
                <th>Missing Dates</th>
                <th>Actions</th>
              </tr>
            ) : null}
          </thead>
          <tbody>
            {rows.map((project) => (
              <tr key={project.id}>
                {columns === "directory" ? (
                  <>
                    <td>
                      <div className="stack-cell">
                        <strong>{safeString(project.projectName) || "Unnamed project"}</strong>
                        <MissingDataChips
                          items={[
                            ...(isMissing(project.poNumber) ? ["Missing PO"] : []),
                            ...(isMissing(project.projectManager) ? ["Missing Manager"] : []),
                            ...(isMissing(project.projectEndDate) ? ["Missing End Date"] : []),
                            ...(project.budgetCost == null ? ["Missing Budget"] : [])
                          ]}
                        />
                      </div>
                    </td>
                    <td><StatusBadge status={project.projectStatus} /></td>
                    <td>{renderMissing(project.projectRegion)}</td>
                    <td className="cell-truncate" title={safeString(project.projectManager)}>{renderMissing(project.projectManager)}</td>
                    <td>{safeDateLabel(project.projectStartDate)}</td>
                    <td>{safeDateLabel(project.projectEndDate)}</td>
                    <td>{renderMissing(project.poNumber)}</td>
                    <td className="cell-number">{project.budgetCost == null ? <span className="missing-badge">Missing</span> : formatMoney(project.budgetCost, project.projectCurrency)}</td>
                  </>
                ) : null}
                {columns === "financials" ? (
                  <>
                    <td className="cell-truncate" title={safeString(project.projectName)}>{safeString(project.projectName) || "Unnamed project"}</td>
                    <td>{renderMissing(project.projectCurrency)}</td>
                    <td className="cell-number">{renderNullableNumber(project.projectEstimatedHrs)}</td>
                    <td className="cell-number">{renderNullableNumber(project.budgetHours)}</td>
                    <td className="cell-number">{project.budgetCost == null ? <span className="missing-badge">Missing</span> : formatMoney(project.budgetCost, project.projectCurrency)}</td>
                    <td className="cell-number">
                      {project.expenseBudgetProjectCurrency == null ? (
                        <span className="missing-badge">Missing</span>
                      ) : (
                        formatMoney(project.expenseBudgetProjectCurrency, project.projectCurrency)
                      )}
                    </td>
                    <td className="cell-number">{renderNullableNumber(project.numberOfResources)}</td>
                    <td className="cell-number">{renderNullableNumber(project.numberOfWorkWeeks)}</td>
                  </>
                ) : null}
                {columns === "metadata" ? (
                  <>
                    <td className="cell-truncate" title={safeString(project.projectName)}>{safeString(project.projectName) || "Unnamed project"}</td>
                    <td className="cell-truncate" title={safeString(project.projectManagerEmail)}>{renderMissing(project.projectManagerEmail)}</td>
                    <td>{renderMissing(project.projectSoldBy)}</td>
                    <td className="cell-truncate" title={safeString(project.projectDescription)}>{renderMissing(project.projectDescription)}</td>
                    <td>{safeDateLabel(project.projectStartDate)}</td>
                    <td>{safeDateLabel(project.projectEndDate)}</td>
                    <td>{renderMissing(project.poNumber)}</td>
                  </>
                ) : null}
                {columns === "missing" ? (
                  <>
                    <td>{safeString(project.projectName) || "Unnamed project"}</td>
                    <td>{isMissing(project.poNumber) ? <span className="missing-badge">Missing</span> : "OK"}</td>
                    <td>{isMissing(project.projectManager) ? <span className="missing-badge">Missing</span> : "OK"}</td>
                    <td>{isMissing(project.projectManagerEmail) ? <span className="missing-badge">Missing</span> : "OK"}</td>
                    <td>{isMissing(project.projectRegion) ? <span className="missing-badge">Missing</span> : "OK"}</td>
                    <td>{project.budgetCost == null ? <span className="missing-badge">Missing</span> : "OK"}</td>
                    <td>{isMissing(project.projectDescription) ? <span className="missing-badge">Missing</span> : "OK"}</td>
                    <td>
                      {isMissing(project.projectStartDate) || isMissing(project.projectEndDate) ? (
                        <span className="missing-badge">Missing</span>
                      ) : (
                        "OK"
                      )}
                    </td>
                  </>
                ) : null}
                <td className="row-actions">
                  <button className="button button--ghost action-button--compact" onClick={() => onView(project)} type="button">
                    View
                  </button>
                  <button className="button action-button--compact" onClick={() => onEdit(project)} type="button">
                    Edit
                  </button>
                  <button className="button button--danger action-button--compact" onClick={() => onDelete(project)} type="button">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? (
        <EmptyState
          title="No projects match this tab and filter combination."
          description="Clear filters or switch tabs to broaden the results."
          compact
        />
      ) : null}
      <div className="pagination">
        <span>
          Page {page} of {totalPages} • {total} projects
        </span>
        <div className="pagination__actions">
          <button className="button" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} type="button">
            Previous
          </button>
          <button className="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} type="button">
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

const renderMissing = (value: unknown) =>
  isMissing(value) ? <span className="missing-badge">Missing</span> : safeString(value);

const renderNullableNumber = (value: number | null) =>
  value == null ? <span className="missing-badge">Missing</span> : value.toLocaleString();

const uniqueStringValues = (values: Array<string | null>) =>
  [...new Set(values.map((value) => safeString(value)).filter(Boolean))].sort((a, b) => a.localeCompare(b));

const groupCounts = (values: Array<string | null>) =>
  [...values.reduce((map, value) => {
    const label = safeString(value) || "Missing";
    map.set(label, (map.get(label) ?? 0) + 1);
    return map;
  }, new Map<string, number>()).entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

const groupSums = (items: Project[], key: keyof Project, valueKey: keyof Project) =>
  [...items.reduce((map, item) => {
    const label = safeString(item[key]) || "Missing";
    const amount = item[valueKey] == null ? 0 : cleanNumber(item[valueKey]);
    map.set(label, (map.get(label) ?? 0) + amount);
    return map;
  }, new Map<string, number>()).entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

const formatCompactMoney = (value: number) =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const resetTabPages = (
  setTabPages: React.Dispatch<
    React.SetStateAction<Record<ProjectTab, number>>
  >
) =>
  setTabPages({
    Overview: 1,
    Directory: 1,
    "Financials / Hours": 1,
    "Details / Metadata": 1,
    "Missing Data": 1
  });
