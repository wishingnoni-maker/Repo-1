import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChartCard } from "../components/ChartCard";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Modal } from "../components/Modal";
import { StatCard } from "../components/StatCard";
import { TimeEntryDrawer } from "../components/TimeEntryDrawer";
import { TimeEntryForm } from "../components/TimeEntryForm";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { formatMoney, isMissing, safeLower, safeString } from "../lib/safe";
import type { Client, TimeEntry, TimeEntryEmployeeOption, TimeEntryProjectOption, TimeEntryFilters } from "../types";

const tabs = ["Submit Time", "Entries", "Team Summary", "Reports"] as const;
type TimeTrackingTab = (typeof tabs)[number];

const categories = [
  "Client Work",
  "Project Management",
  "Internal Meeting",
  "Research",
  "Admin",
  "Support",
  "Travel",
  "Other"
] as const;

const today = () => new Date().toISOString().slice(0, 10);
const startOfMonth = () => {
  const value = new Date();
  value.setUTCDate(1);
  return value.toISOString().slice(0, 10);
};
const startOfWeek = () => {
  const value = new Date();
  const day = value.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  value.setUTCDate(value.getUTCDate() - offset);
  return value.toISOString().slice(0, 10);
};

type TimeTrackingFilters = Omit<TimeEntryFilters, "billable"> & {
  billable: "all" | "true" | "false";
};

const defaultFilters: TimeTrackingFilters = {
  employeeId: "",
  clientId: "",
  projectId: "",
  startDate: startOfMonth(),
  endDate: today(),
  billable: "all",
  workCategory: "",
  search: "",
  page: 1,
  pageSize: 25,
  sortBy: "workDate",
  sortDirection: "desc"
};

const sumHours = (entries: TimeEntry[]) => entries.reduce((sum, entry) => sum + entry.hours, 0);

const groupHours = <T extends { label: string; value: number }>(entries: TimeEntry[], keyOf: (entry: TimeEntry) => string) =>
  Array.from(
    entries.reduce((map, entry) => {
      const key = keyOf(entry) || "Unassigned";
      map.set(key, (map.get(key) ?? 0) + entry.hours);
      return map;
    }, new Map<string, number>())
  )
    .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)) as T[];

const weekLabel = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  const day = parsed.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  parsed.setUTCDate(parsed.getUTCDate() - offset);
  return parsed.toISOString().slice(0, 10);
};

const withinRange = (value: string, start?: string, end?: string) => {
  if (start && value < start) return false;
  if (end && value > end) return false;
  return true;
};

const activeProjectStatuses = new Set(["active", "in progress", "open", "current", "ongoing", "started"]);

const deriveEmployeeOptions = (
  employees: Array<{
    id: string;
    fullName: string;
    email: string;
    title: string;
    employeeRegion: string;
    supervisorName: string;
  }>
): TimeEntryEmployeeOption[] =>
  [...employees]
    .map((employee) => ({
      id: employee.id,
      fullName: employee.fullName,
      email: employee.email,
      title: employee.title,
      employeeRegion: employee.employeeRegion,
      supervisorName: employee.supervisorName
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

const findLikelyClientName = (projectName: string, clients: Client[]) => {
  const normalizedProject = safeLower(projectName);
  const matches = clients.filter((client) => {
    const normalizedClient = safeLower(client.clientName);
    return normalizedClient && normalizedProject.includes(normalizedClient);
  });
  if (!matches.length) {
    return null;
  }
  return [...matches].sort((a, b) => b.clientName.length - a.clientName.length)[0] ?? null;
};

const isEligibleProject = (project: {
  projectStartDate: string | null;
  projectEndDate: string | null;
  projectStatus: string;
}) => {
  const now = new Date();
  const fiveYearsAgo = new Date(now);
  fiveYearsAgo.setUTCFullYear(fiveYearsAgo.getUTCFullYear() - 5);
  const start = project.projectStartDate ? new Date(project.projectStartDate) : null;
  const end = project.projectEndDate ? new Date(project.projectEndDate) : null;
  const status = safeLower(project.projectStatus);

  if (start && !Number.isNaN(start.getTime()) && start >= fiveYearsAgo) return true;
  if (end && !Number.isNaN(end.getTime()) && end >= fiveYearsAgo) return true;
  if (activeProjectStatuses.has(status)) return true;
  if (!end && start && !Number.isNaN(start.getTime()) && start >= fiveYearsAgo) return true;
  return false;
};

const deriveProjectOptions = (projects: Array<{
  id: string;
  projectName: string;
  projectStatus: string;
  projectManager: string;
  projectStartDate: string | null;
  projectEndDate: string | null;
  projectRegion: string;
  budgetHours: number | null;
  budgetCost: number | null;
}>, clients: Client[]): TimeEntryProjectOption[] =>
  projects
    .filter((project) => isEligibleProject(project))
    .map((project) => {
      const client = findLikelyClientName(project.projectName, clients);
      return {
        id: project.id,
        projectName: project.projectName,
        clientId: client?.id ?? null,
        clientName: client?.clientName ?? "",
        projectStatus: project.projectStatus,
        projectManager: project.projectManager,
        projectStartDate: project.projectStartDate,
        projectEndDate: project.projectEndDate,
        projectRegion: project.projectRegion,
        budgetHours: project.budgetHours,
        budgetCost: project.budgetCost,
        label: [project.projectName, client?.clientName, project.projectManager, project.projectStatus]
          .filter(Boolean)
          .join(" — ")
      };
    })
    .sort((a, b) => a.projectName.localeCompare(b.projectName));

export function TimeTrackingPage({
  refreshToken,
  onDataChange
}: {
  refreshToken: number;
  onDataChange: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TimeTrackingTab>("Submit Time");
  const [filters, setFilters] = useState(defaultFilters);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [employees, setEmployees] = useState<TimeEntryEmployeeOption[]>([]);
  const [projects, setProjects] = useState<TimeEntryProjectOption[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [detail, setDetail] = useState<TimeEntry | null>(null);
  const [editTarget, setEditTarget] = useState<TimeEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setLoadWarnings([]);
    setLoadingEmployees(true);
    setLoadingProjects(true);
    setLoadingClients(true);

    const load = async () => {
      const warnings: string[] = [];

      const clientPromise = api.getClients({
        search: "",
        clientStatus: "",
        clientInvoiceCurrency: "",
        clientManager: "",
        missingContact: false,
        missingDescription: false,
        missingManager: false,
        page: 1,
        pageSize: 5000
      });

      const [clientResult, entryResult, employeeOptionsResult, projectOptionsResult] = await Promise.allSettled([
        clientPromise,
        api.getTimeEntries({
          page: 1,
          pageSize: 5000,
          sortBy: "workDate",
          sortDirection: "desc"
        }),
        api.getTimeEntryEmployeeOptions(),
        api.getTimeEntryProjectOptions()
      ]);

      const loadedClients =
        clientResult.status === "fulfilled" ? clientResult.value.data : [];
      if (active) {
        setClients(loadedClients);
        setLoadingClients(false);
      }
      if (clientResult.status !== "fulfilled") {
        warnings.push("Clients could not be loaded from the API.");
      }

      if (entryResult.status === "fulfilled") {
        if (active) {
          setEntries(entryResult.value.data);
        }
      } else if (active) {
        setEntries([]);
        setError(entryResult.reason instanceof Error ? entryResult.reason.message : "Time entries failed to load.");
      }

      if (employeeOptionsResult.status === "fulfilled" && employeeOptionsResult.value.length > 0) {
        if (active) {
          setEmployees(employeeOptionsResult.value);
          setLoadingEmployees(false);
        }
      } else {
        try {
          const fallbackEmployees = await api.getEmployees({
            search: "",
            region: "",
            country: "",
            title: "",
            supervisor: "",
            titleCode: "",
            hireYear: "",
            page: 1,
            pageSize: 5000,
            sortBy: "name",
            sortDirection: "asc"
          });
          if (active) {
            setEmployees(deriveEmployeeOptions(fallbackEmployees.data));
            setLoadingEmployees(false);
          }
          warnings.push("Using fallback employee data from the main Employees API.");
        } catch (caught) {
          if (active) {
            setEmployees([]);
            setLoadingEmployees(false);
          }
          warnings.push(caught instanceof Error ? caught.message : "Employees failed to load.");
        }
      }

      if (projectOptionsResult.status === "fulfilled" && projectOptionsResult.value.length > 0) {
        if (active) {
          setProjects(projectOptionsResult.value);
          setLoadingProjects(false);
        }
      } else {
        try {
          const fallbackProjects = await api.getProjects({
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
          });
          if (active) {
            setProjects(deriveProjectOptions(fallbackProjects.data, loadedClients));
            setLoadingProjects(false);
          }
          warnings.push(
            fallbackProjects.data.length
              ? "Using fallback project data from the main Projects API."
              : "No project records were returned from the Projects API."
          );
        } catch (caught) {
          if (active) {
            setProjects([]);
            setLoadingProjects(false);
          }
          warnings.push(caught instanceof Error ? caught.message : "Projects failed to load.");
        }
      }

      if (active) {
        setLoadWarnings([...new Set(warnings)]);
        setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [refreshToken]);

  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => {
        const haystack = safeLower(
          [
            entry.employeeName,
            entry.employeeEmail,
            entry.projectName,
            entry.clientName,
            entry.projectManager,
            entry.workCategory,
            entry.notes
          ].join(" ")
        );
        if (filters.search && !haystack.includes(safeLower(filters.search))) return false;
        if (filters.employeeId && entry.employeeId !== filters.employeeId) return false;
        if (filters.clientId && entry.clientId !== filters.clientId) return false;
        if (filters.projectId && entry.projectId !== filters.projectId) return false;
        if (!withinRange(entry.workDate, filters.startDate, filters.endDate)) return false;
        if (filters.billable === "true" && !entry.billable) return false;
        if (filters.billable === "false" && entry.billable) return false;
        if (filters.workCategory && entry.workCategory !== filters.workCategory) return false;
        return true;
      })
      .sort((a, b) => {
        const direction = filters.sortDirection === "asc" ? 1 : -1;
        switch (filters.sortBy) {
          case "hours":
            return (a.hours - b.hours) * direction;
          case "employeeName":
            return a.employeeName.localeCompare(b.employeeName) * direction;
          case "projectName":
            return a.projectName.localeCompare(b.projectName) * direction;
          case "createdAt":
            return a.createdAt.localeCompare(b.createdAt) * direction;
          case "workDate":
          default:
            return a.workDate.localeCompare(b.workDate) * direction;
        }
      });
  }, [entries, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / filters.pageSize));
  const currentPage = Math.min(filters.page, totalPages);
  const pagedEntries = filteredEntries.slice((currentPage - 1) * filters.pageSize, currentPage * filters.pageSize);

  const weeklyEntries = useMemo(
    () => entries.filter((entry) => withinRange(entry.workDate, startOfWeek(), today())),
    [entries]
  );
  const monthlyEntries = useMemo(
    () => entries.filter((entry) => withinRange(entry.workDate, startOfMonth(), today())),
    [entries]
  );

  const overallSummary = useMemo(() => {
    const totalWeek = sumHours(weeklyEntries);
    const totalMonth = sumHours(monthlyEntries);
    const billableHours = sumHours(entries.filter((entry) => entry.billable));
    const nonBillableHours = sumHours(entries.filter((entry) => !entry.billable));
    const topProject = groupHours(entries, (entry) => entry.projectName)[0];
    return {
      totalWeek,
      totalMonth,
      billableHours,
      nonBillableHours,
      entriesThisWeek: weeklyEntries.length,
      projectsWithTime: new Set(entries.map((entry) => entry.projectId)).size,
      topProject
    };
  }, [entries, monthlyEntries, weeklyEntries]);

  const reportSummary = useMemo(() => {
    const hoursByProject = groupHours(filteredEntries, (entry) => entry.projectName);
    const hoursByEmployee = groupHours(filteredEntries, (entry) => entry.employeeName);
    const hoursByClient = groupHours(filteredEntries, (entry) => entry.clientName || "Unassigned");
    const hoursByWeek = groupHours(filteredEntries, (entry) => weekLabel(entry.workDate));
    const billableByWeek = Array.from(
      filteredEntries.reduce((map, entry) => {
        const key = weekLabel(entry.workDate);
        const current = map.get(key) ?? { label: key, billableHours: 0, nonBillableHours: 0 };
        if (entry.billable) {
          current.billableHours += entry.hours;
        } else {
          current.nonBillableHours += entry.hours;
        }
        map.set(key, current);
        return map;
      }, new Map<string, { label: string; billableHours: number; nonBillableHours: number }>())
    )
      .map(([, value]) => ({
        ...value,
        billableHours: Number(value.billableHours.toFixed(2)),
        nonBillableHours: Number(value.nonBillableHours.toFixed(2))
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const utilizationHints = projects
      .map((project) => {
        const actualHours = Number(
          filteredEntries
            .filter((entry) => entry.projectId === project.id)
            .reduce((sum, entry) => sum + entry.hours, 0)
            .toFixed(2)
        );
        const budgetHours = project.budgetHours;
        const remainingHours = budgetHours == null ? null : Number((budgetHours - actualHours).toFixed(2));
        const percentUsed =
          budgetHours && budgetHours > 0 ? Number(((actualHours / budgetHours) * 100).toFixed(1)) : null;
        const status =
          budgetHours == null
            ? "unbudgeted"
            : percentUsed != null && percentUsed >= 100
              ? "at-risk"
              : percentUsed != null && percentUsed >= 80
                ? "watch"
                : "healthy";
        return {
          projectId: project.id,
          projectName: project.projectName,
          budgetHours,
          actualHours,
          remainingHours,
          percentUsed,
          status
        };
      })
      .filter((item) => item.actualHours > 0)
      .sort((a, b) => b.actualHours - a.actualHours)
      .slice(0, 10);

    return { hoursByProject, hoursByEmployee, hoursByClient, hoursByWeek, billableByWeek, utilizationHints };
  }, [filteredEntries, projects]);

  const filterOptions = useMemo(
    () => ({
      employees,
      clients,
      projects,
      categories
    }),
    [employees, clients, projects]
  );

  const trackedHoursByProject = useMemo(
    () =>
      entries.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.projectId] = Number(((acc[entry.projectId] ?? 0) + entry.hours).toFixed(2));
        return acc;
      }, {}),
    [entries]
  );

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="page-kicker">Operations</span>
            <h3>Time Tracking</h3>
            <p>Track employee project hours, review billable time, and compare actual hours against project budgets.</p>
          </div>
        </div>
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
      </section>

      <section className="stat-grid">
        <StatCard label="Total hours this week" value={overallSummary.totalWeek.toFixed(2)} tone="accent" />
        <StatCard label="Total hours this month" value={overallSummary.totalMonth.toFixed(2)} />
        <StatCard label="Billable hours" value={overallSummary.billableHours.toFixed(2)} />
        <StatCard label="Non-billable hours" value={overallSummary.nonBillableHours.toFixed(2)} />
        <StatCard label="Entries this week" value={overallSummary.entriesThisWeek} />
        <StatCard label="Projects with tracked time" value={overallSummary.projectsWithTime} />
        <StatCard
          label="Top project by hours"
          value={overallSummary.topProject ? `${overallSummary.topProject.label} (${overallSummary.topProject.value.toFixed(1)})` : "No entries"}
        />
      </section>

      {activeTab === "Submit Time" ? (
        <section className="page-grid page-grid--two">
          <div className="panel">
            <div className="panel__header">
              <div>
                <h3>Submit time</h3>
                <p>Log project work using existing employee and project data from Neon.</p>
              </div>
            </div>
            <TimeEntryForm
              employees={employees}
              projects={projects}
              clients={clients}
              loadingEmployees={loadingEmployees}
              loadingProjects={loadingProjects}
              loadingClients={loadingClients}
              trackedHoursByProject={trackedHoursByProject}
              onSubmit={async (payload) => {
                const created = await api.createTimeEntry(payload);
                setEntries((prev) => [created, ...prev]);
                onDataChange();
              }}
              submitLabel="Submit time"
            />
          </div>

          <div className="panel">
            <div className="panel__header">
              <div>
                <h3>Recent entries</h3>
                <p>The newest time captured across the team.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Project</th>
                    <th>Hours</th>
                    <th>Billable</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {entries.slice(0, 8).map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.workDate)}</td>
                      <td>{entry.employeeName}</td>
                      <td>{entry.projectName}</td>
                      <td>{entry.hours.toFixed(2)}</td>
                      <td>{entry.billable ? "Yes" : "No"}</td>
                      <td className="row-actions">
                        <button className="button button--ghost" onClick={() => setDetail(entry)} type="button">
                          View
                        </button>
                        <button className="button" onClick={() => setEditTarget(entry)} type="button">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!entries.length ? (
              <div className="empty-state">
                No time entries yet. Use the form to log the first one.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {loadWarnings.length ? (
        <div className="helper-banner">
          {loadWarnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}

      {activeTab === "Entries" ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h3>Time entries</h3>
              <p>Filter, review, edit, and delete tracked work.</p>
            </div>
          </div>
          <div className="filters">
            <input
              placeholder="Search by employee, project, client, manager, notes"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, page: 1, search: event.target.value }))}
            />
            <select
              value={filters.employeeId}
              onChange={(event) => setFilters((current) => ({ ...current, page: 1, employeeId: event.target.value }))}
            >
              <option value="">All employees</option>
              {filterOptions.employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </select>
            <select
              value={filters.projectId}
              onChange={(event) => setFilters((current) => ({ ...current, page: 1, projectId: event.target.value }))}
            >
              <option value="">All projects</option>
              {filterOptions.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.projectName}
                </option>
              ))}
            </select>
            <select
              value={filters.clientId}
              onChange={(event) => setFilters((current) => ({ ...current, page: 1, clientId: event.target.value }))}
            >
              <option value="">All clients</option>
              {filterOptions.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.clientName}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilters((current) => ({ ...current, page: 1, startDate: event.target.value }))}
            />
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilters((current) => ({ ...current, page: 1, endDate: event.target.value }))}
            />
            <select
              value={filters.billable}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  page: 1,
                  billable: event.target.value as typeof filters.billable
                }))
              }
            >
              <option value="all">All time</option>
              <option value="true">Billable only</option>
              <option value="false">Non-billable only</option>
            </select>
            <select
              value={filters.workCategory}
              onChange={(event) => setFilters((current) => ({ ...current, page: 1, workCategory: event.target.value }))}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              value={filters.pageSize}
              onChange={(event) =>
                setFilters((current) => ({ ...current, page: 1, pageSize: Number(event.target.value) }))
              }
            >
              {[25, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value} per page
                </option>
              ))}
            </select>
          </div>

          <div className="table-actions">
            <a className="button button--ghost" href={api.exportUrl("/time-entries/export")} target="_blank" rel="noreferrer">
              Export CSV
            </a>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Project</th>
                  <th>Client</th>
                  <th>Hours</th>
                  <th>Billable</th>
                  <th>Category</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pagedEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.workDate)}</td>
                    <td>{entry.employeeName}</td>
                    <td>{entry.projectName}</td>
                    <td>{entry.clientName || <span className="missing-badge">Missing</span>}</td>
                    <td>{entry.hours.toFixed(2)}</td>
                    <td>{entry.billable ? "Billable" : "Non-billable"}</td>
                    <td>{entry.workCategory}</td>
                    <td>{safeString(entry.notes).slice(0, 60) || <span className="missing-badge">Missing</span>}</td>
                    <td className="row-actions">
                      <button className="button button--ghost" onClick={() => setDetail(entry)} type="button">
                        View
                      </button>
                      <button className="button" onClick={() => setEditTarget(entry)} type="button">
                        Edit
                      </button>
                      <button className="button button--danger" onClick={() => setDeleteTarget(entry)} type="button">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!pagedEntries.length && !loading ? (
            <div className="empty-state">No time entries match the current filters.</div>
          ) : null}

          <div className="pagination">
            <span>
              Page {currentPage} of {totalPages} • {filteredEntries.length} entries
            </span>
            <div className="pagination__actions">
              <button
                className="button"
                disabled={currentPage <= 1}
                onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
                type="button"
              >
                Previous
              </button>
              <button
                className="button"
                disabled={currentPage >= totalPages}
                onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "Team Summary" ? (
        <section className="page-grid page-grid--two">
          <ChartCard title="Hours by project">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={reportSummary.hoursByProject.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#0f766e" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Hours by employee">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={reportSummary.hoursByEmployee.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Hours by client">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={reportSummary.hoursByClient.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Budget vs actual utilization">
            <ul className="stack-list">
              {reportSummary.utilizationHints.map((hint) => (
                <li key={hint.projectId}>
                  <strong>{hint.projectName}</strong>
                  <span>
                    Actual {hint.actualHours.toFixed(2)} hrs
                    {hint.budgetHours == null
                      ? " • No budget hours available"
                      : ` • Budget ${hint.budgetHours.toFixed(2)} • Remaining ${hint.remainingHours?.toFixed(2) ?? "0.00"} • ${hint.percentUsed?.toFixed(1) ?? "0.0"}% used`}
                  </span>
                </li>
              ))}
            </ul>
          </ChartCard>
        </section>
      ) : null}

      {activeTab === "Reports" ? (
        <section className="page-grid page-grid--two">
          <ChartCard title="Weekly hours trend">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={reportSummary.hoursByWeek}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Billable vs non-billable by week">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={reportSummary.billableByWeek}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="billableHours" stackId="hours" fill="#0f766e" />
                <Bar dataKey="nonBillableHours" stackId="hours" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Filtered summary">
            <div className="summary-grid">
              <div>
                <span>Total filtered hours</span>
                <strong>{sumHours(filteredEntries).toFixed(2)}</strong>
              </div>
              <div>
                <span>Billable filtered hours</span>
                <strong>{sumHours(filteredEntries.filter((entry) => entry.billable)).toFixed(2)}</strong>
              </div>
              <div>
                <span>Unique employees</span>
                <strong>{new Set(filteredEntries.map((entry) => entry.employeeId)).size}</strong>
              </div>
              <div>
                <span>Unique projects</span>
                <strong>{new Set(filteredEntries.map((entry) => entry.projectId)).size}</strong>
              </div>
            </div>
          </ChartCard>
          <ChartCard title="Export">
            <p>Download the current time entry dataset as CSV for offline analysis or finance handoff.</p>
            <a className="button button--primary" href={api.exportUrl("/time-entries/export")} target="_blank" rel="noreferrer">
              Export time entries CSV
            </a>
          </ChartCard>
        </section>
      ) : null}

      {loading ? <div className="empty-state">Loading time tracking...</div> : null}
      {error ? <div className="error-text">{error}</div> : null}

      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={editTarget ? "Edit time entry" : "Edit time entry"}
        width="wide"
      >
        <TimeEntryForm
          initialValue={editTarget ?? undefined}
          employees={employees}
          projects={projects}
          clients={clients}
          onSubmit={async (payload) => {
            if (!editTarget) return;
            const updated = await api.updateTimeEntry(editTarget.id, payload);
            setEntries((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
            setEditTarget(null);
            if (detail?.id === updated.id) {
              setDetail(updated);
            }
            onDataChange();
          }}
          submitLabel="Save changes"
        />
      </Modal>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Time entry details" width="wide">
        {detail ? <TimeEntryDrawer entry={detail} /> : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.deleteTimeEntry(deleteTarget.id);
          setEntries((prev) => prev.filter((entry) => entry.id !== deleteTarget.id));
          if (detail?.id === deleteTarget.id) {
            setDetail(null);
          }
          onDataChange();
        }}
        title="Delete time entry"
        message={`Are you sure you want to delete the ${deleteTarget?.projectName ?? "selected"} time entry for ${deleteTarget?.employeeName ?? "this employee"}?`}
      />
    </div>
  );
}
