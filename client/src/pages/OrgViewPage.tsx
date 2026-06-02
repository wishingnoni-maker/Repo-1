import { useEffect, useMemo, useState } from "react";
import { DetailDrawer } from "../components/DetailDrawer";
import { EmployeeDrawer } from "../components/EmployeeDrawer";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { api } from "../lib/api";
import { uniqueValues } from "../lib/format";
import { isMissing, safeLower, safeString } from "../lib/safe";
import type { Employee, EmployeeDetailResponse } from "../types";

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

interface OrgFilters {
  region: string;
  country: string;
  title: string;
  missingOnly: boolean;
}

interface SupervisorStatus {
  state: "valid" | "missing" | "invalid";
  supervisorKey: string;
}

interface ValidSupervisorGroup {
  key: string;
  supervisorName: string;
  reports: Employee[];
  regions: string[];
}

export function OrgViewPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filters, setFilters] = useState<OrgFilters>({
    region: "",
    country: "",
    title: "",
    missingOnly: false
  });
  const [detail, setDetail] = useState<EmployeeDetailResponse | null>(null);
  const [assignTarget, setAssignTarget] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .getEmployees(employeeFilters)
      .then((result) => setEmployees(result.data))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Org view failed to load."))
      .finally(() => setLoading(false));
  }, []);

  const employeeNameMap = useMemo(
    () => new Map(employees.map((employee) => [normalizeName(employee.fullName), employee])),
    [employees]
  );

  const supervisorStatusMap = useMemo(
    () =>
      new Map(
        employees.map((employee) => [employee.id, getSupervisorStatus(employee, employeeNameMap)])
      ),
    [employeeNameMap, employees]
  );

  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        if (filters.region && safeString(employee.employeeRegion) !== filters.region) return false;
        if (filters.country && safeString(employee.country) !== filters.country) return false;
        if (filters.title && safeString(employee.title) !== filters.title) return false;
        if (filters.missingOnly) {
          const status = supervisorStatusMap.get(employee.id);
          if (!status || status.state === "valid") return false;
        }
        return true;
      }),
    [employees, filters, supervisorStatusMap]
  );

  const visibleNameMap = useMemo(
    () => new Map(filteredEmployees.map((employee) => [normalizeName(employee.fullName), employee])),
    [filteredEmployees]
  );

  const validGroups = useMemo(
    () => buildValidGroups(filteredEmployees, supervisorStatusMap),
    [filteredEmployees, supervisorStatusMap]
  );

  const missingOrInvalidEmployees = useMemo(
    () =>
      filteredEmployees.filter((employee) => {
        const status = supervisorStatusMap.get(employee.id);
        return status && status.state !== "valid";
      }),
    [filteredEmployees, supervisorStatusMap]
  );

  const counts = useMemo(() => {
    let missingCount = 0;
    let invalidCount = 0;

    employees.forEach((employee) => {
      const status = supervisorStatusMap.get(employee.id);
      if (!status) return;
      if (status.state === "missing") missingCount += 1;
      if (status.state === "invalid") invalidCount += 1;
    });

    return {
      totalSupervisors: validGroups.length,
      missingCount,
      invalidCount
    };
  }, [employees, supervisorStatusMap, validGroups.length]);

  const filterOptions = useMemo(
    () => ({
      regions: uniqueValues(employees.map((employee) => safeString(employee.employeeRegion))),
      countries: uniqueValues(employees.map((employee) => safeString(employee.country))),
      titles: uniqueValues(employees.map((employee) => safeString(employee.title)))
    }),
    [employees]
  );

  const employeeOptions = useMemo(
    () =>
      uniqueValues(
        employees.map((employee) => safeString(employee.fullName)).filter(Boolean)
      ),
    [employees]
  );

  return (
    <div className="page-grid">
      <PageHeader
        eyebrow="Workforce operations"
        title="Org View"
        subtitle="Review supervisors, direct reports, and unresolved reporting gaps."
      />

      <section className="stat-grid">
        <StatCard label="Total supervisors" value={counts.totalSupervisors} tone="accent" />
        <StatCard label="Employees missing supervisor" value={counts.missingCount} tone="warn" />
        <StatCard label="Employees with invalid supervisor" value={counts.invalidCount} tone="warn" />
      </section>

      <section className="panel">
        <div className="filters">
          <select
            value={filters.region}
            onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value }))}
          >
            <option value="">All regions</option>
            {filterOptions.regions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            value={filters.country}
            onChange={(event) => setFilters((current) => ({ ...current, country: event.target.value }))}
          >
            <option value="">All countries</option>
            {filterOptions.countries.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            value={filters.title}
            onChange={(event) => setFilters((current) => ({ ...current, title: event.target.value }))}
          >
            <option value="">All titles</option>
            {filterOptions.titles.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <label className="toggle">
            <input
              checked={filters.missingOnly}
              onChange={(event) => setFilters((current) => ({ ...current, missingOnly: event.target.checked }))}
              type="checkbox"
            />
            <span>Missing only</span>
          </label>
        </div>
      </section>

      {!filters.missingOnly ? (
        <section className="page-grid">
          {validGroups.map((group) => (
            <details className="org-group" key={group.key} open>
              <summary className="org-group__summary">
                <div>
                  <strong>{group.supervisorName}</strong>
                  <p>
                    {group.reports.length} reports
                    {group.regions.length ? ` • ${group.regions.join(", ")}` : ""}
                  </p>
                </div>
                <div className="badge-row">
                  <span className="badge badge--ok">Valid supervisor</span>
                </div>
              </summary>
              <div className="org-group__body">
                <ul className="stack-list">
                  {group.reports.map((employee) => (
                    <li className="org-report-card" key={employee.id}>
                      <div>
                        <strong>{employee.fullName}</strong>
                        <span>
                          {safeString(employee.title) || "Missing title"} • {safeString(employee.employeeRegion) || "Missing region"} • {safeString(employee.country) || "Missing country"}
                        </span>
                      </div>
                      <div className="row-actions">
                        <button
                          className="button button--ghost"
                          onClick={() => openEmployeeDetail(employee, visibleNameMap, employees, setDetail)}
                          type="button"
                        >
                          View
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Missing or Invalid Supervisor</h3>
            <p>Only employees whose supervisor is blank or not found in the current employee list appear here.</p>
          </div>
        </div>
        <ul className="stack-list">
          {missingOrInvalidEmployees.map((employee) => {
            const status = supervisorStatusMap.get(employee.id);
            return (
              <li className="org-report-card" key={employee.id}>
                <div>
                  <strong>{employee.fullName}</strong>
                  <span>
                    {safeString(employee.title) || "Missing title"} • {safeString(employee.employeeRegion) || "Missing region"} • {safeString(employee.country) || "Missing country"}
                  </span>
                  <div className="badge-row">
                    <span className="missing-badge">
                      {status?.state === "missing" ? "Missing supervisor" : "Invalid supervisor"}
                    </span>
                    {!isMissing(employee.supervisorName) ? (
                      <span className="badge badge--warn">Provided: {safeString(employee.supervisorName)}</span>
                    ) : null}
                  </div>
                </div>
                <div className="row-actions">
                  <button
                    className="button button--ghost"
                    onClick={() => openEmployeeDetail(employee, visibleNameMap, employees, setDetail)}
                    type="button"
                  >
                    View
                  </button>
                  <button
                    className="button button--primary"
                    onClick={() => setAssignTarget(employee)}
                    type="button"
                  >
                    Assign supervisor
                  </button>
                </div>
              </li>
            );
          })}
          {!missingOrInvalidEmployees.length && !loading ? (
            <li><EmptyState title="No missing or invalid supervisors." description="The current filtered employee set has complete reporting lines." compact /></li>
          ) : null}
        </ul>
      </section>

      {loading ? <EmptyState title="Loading org chart..." description="Reviewing the current reporting structure." tone="loading" /> : null}
      {error ? <EmptyState title="Unable to load org view." description={error} tone="error" /> : null}

      <DetailDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.employee.fullName ?? "Employee details"}
        subtitle={detail?.employee.title || "Employee profile"}
      >
        <EmployeeDrawer detail={detail} onClose={() => setDetail(null)} embedded />
      </DetailDrawer>

      <Modal open={Boolean(assignTarget)} onClose={() => setAssignTarget(null)} title="Assign supervisor">
        {assignTarget ? (
          <AssignSupervisorForm
            employee={assignTarget}
            options={employeeOptions.filter((name) => safeLower(name) !== safeLower(assignTarget.fullName))}
            onSubmit={async (supervisorName) => {
              const updated = await api.updateEmployee(assignTarget.id, { supervisorName });
              const nextEmployees = employees.map((employee) => (employee.id === updated.id ? updated : employee));
              setEmployees(nextEmployees);
              if (detail?.employee.id === updated.id) {
                openEmployeeDetail(
                  updated,
                  new Map(nextEmployees.map((employee) => [normalizeName(employee.fullName), employee])),
                  nextEmployees,
                  setDetail
                );
              }
              setAssignTarget(null);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function AssignSupervisorForm({
  employee,
  options,
  onSubmit
}: {
  employee: Employee;
  options: string[];
  onSubmit: (supervisorName: string) => Promise<void>;
}) {
  const [value, setValue] = useState(safeString(employee.supervisorName));
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSubmit(value);
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="hint-box">
        <strong>{employee.fullName}</strong>
        <div>{safeString(employee.title) || "Missing title"}</div>
      </div>
      <label>
        <span>Supervisor</span>
        <input
          list="org-supervisor-options"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Select or type supervisor name"
        />
        <datalist id="org-supervisor-options">
          {options.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <button className="button button--primary" disabled={saving} type="submit">
        {saving ? "Saving..." : "Assign supervisor"}
      </button>
    </form>
  );
}

const normalizeName = (value: unknown) =>
  (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const getSupervisorStatus = (
  employee: Employee,
  employeeNameMap: Map<string, Employee>
): SupervisorStatus => {
  const supervisorRaw = employee.supervisorName;
  const supervisorKey = normalizeName(supervisorRaw);

  if (!supervisorKey) {
    return { state: "missing", supervisorKey };
  }

  if (!employeeNameMap.has(supervisorKey)) {
    return { state: "invalid", supervisorKey };
  }

  return { state: "valid", supervisorKey };
};

const buildValidGroups = (
  visibleEmployees: Employee[],
  supervisorStatusMap: Map<string, SupervisorStatus>
): ValidSupervisorGroup[] =>
  [...visibleEmployees.reduce((map, employee) => {
    const status = supervisorStatusMap.get(employee.id);
    if (!status || status.state !== "valid") {
      return map;
    }

    const supervisorName = safeString(employee.supervisorName);
    const key = normalizeName(supervisorName);
    const current = map.get(key) ?? {
      key,
      supervisorName,
      reports: [] as Employee[],
      regions: [] as string[]
    };

    current.reports.push(employee);

    const region = safeString(employee.employeeRegion);
    if (region && !current.regions.includes(region)) {
      current.regions.push(region);
    }

    map.set(key, current);
    return map;
  }, new Map<string, ValidSupervisorGroup>()).values()].sort(
    (a, b) => b.reports.length - a.reports.length || a.supervisorName.localeCompare(b.supervisorName)
  );

const openEmployeeDetail = (
  employee: Employee,
  visibleNameMap: Map<string, Employee>,
  allEmployees: Employee[],
  setDetail: React.Dispatch<React.SetStateAction<EmployeeDetailResponse | null>>
) => {
  const supervisor = visibleNameMap.get(normalizeName(employee.supervisorName)) ?? null;
  const directReports = allEmployees.filter(
    (candidate) => normalizeName(candidate.supervisorName) === normalizeName(employee.fullName)
  );
  const relatedEmployees = allEmployees
    .filter(
      (candidate) =>
        candidate.id !== employee.id &&
        (safeString(candidate.employeeRegion) === safeString(employee.employeeRegion) ||
          safeString(candidate.titleCode) === safeString(employee.titleCode))
    )
    .slice(0, 10);

  setDetail({ employee, supervisor, directReports, relatedEmployees });
};
