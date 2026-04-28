import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmployeeDrawer } from "../components/EmployeeDrawer";
import { EmployeeForm } from "../components/EmployeeForm";
import { Modal } from "../components/Modal";
import { api } from "../lib/api";
import { formatDate, getTenureLabel, uniqueValues } from "../lib/format";
import { isMissing, safeLower, safeString } from "../lib/safe";
import type { Employee, EmployeeDetailResponse, EmployeeFilters } from "../types";

const defaultFilters: EmployeeFilters = {
  search: "",
  region: "",
  country: "",
  title: "",
  supervisor: "",
  titleCode: "",
  hireYear: "",
  page: 1,
  pageSize: 10,
  sortBy: "name",
  sortDirection: "asc"
};

interface EmployeesPageProps {
  refreshToken: number;
  onDataChange: () => void;
}

export function EmployeesPage({ refreshToken, onDataChange }: EmployeesPageProps) {
  const [filters, setFilters] = useState<EmployeeFilters>(defaultFilters);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<EmployeeDetailResponse | null>(null);
  const [editTarget, setEditTarget] = useState<Partial<Employee> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bulkFields, setBulkFields] = useState({
    employeeRegion: "",
    supervisorName: "",
    country: "",
    title: ""
  });

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .getEmployees({ ...defaultFilters, page: 1, pageSize: 5000 })
      .then((result) => setAllEmployees(result.data))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Employees failed to load."))
      .finally(() => setLoading(false));
  }, [refreshToken]);

  const filteredEmployees = useMemo(() => {
    const search = safeLower(filters.search);
    const items = allEmployees.filter((employee) => {
      const haystack = safeLower(
        [
          employee.fullName,
          employee.email,
          employee.title,
          employee.supervisorName,
          employee.employeeRegion,
          employee.country
        ].join(" ")
      );
      if (search && !haystack.includes(search)) return false;
      if (filters.region && safeString(employee.employeeRegion) !== filters.region) return false;
      if (filters.country && safeString(employee.country) !== filters.country) return false;
      if (filters.title && safeString(employee.title) !== filters.title) return false;
      if (filters.supervisor && safeString(employee.supervisorName) !== filters.supervisor) return false;
      if (filters.titleCode && safeString(employee.titleCode) !== filters.titleCode) return false;
      if (filters.hireYear) {
        const parsed = employee.hireDate ? new Date(employee.hireDate) : null;
        const year = parsed && !Number.isNaN(parsed.getTime()) ? String(parsed.getUTCFullYear()) : "";
        if (year !== filters.hireYear) return false;
      }
      return true;
    });

    return [...items].sort((a, b) => {
      const direction = filters.sortDirection === "asc" ? 1 : -1;
      switch (filters.sortBy) {
        case "hireDate":
          return safeString(a.hireDate).localeCompare(safeString(b.hireDate)) * direction;
        case "region":
          return safeString(a.employeeRegion).localeCompare(safeString(b.employeeRegion)) * direction;
        case "title":
          return safeString(a.title).localeCompare(safeString(b.title)) * direction;
        case "tenure":
          return (getTenureValue(a) - getTenureValue(b)) * direction;
        case "name":
        default:
          return safeString(a.fullName).localeCompare(safeString(b.fullName)) * direction;
      }
    });
  }, [allEmployees, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / filters.pageSize));
  const currentPage = Math.min(filters.page, totalPages);
  const pagedEmployees = filteredEmployees.slice(
    (currentPage - 1) * filters.pageSize,
    currentPage * filters.pageSize
  );

  const filterOptions = useMemo(
    () => ({
      regions: uniqueValues(allEmployees.map((employee) => safeString(employee.employeeRegion))),
      countries: uniqueValues(allEmployees.map((employee) => safeString(employee.country))),
      titles: uniqueValues(allEmployees.map((employee) => safeString(employee.title))),
      supervisors: uniqueValues(allEmployees.map((employee) => safeString(employee.supervisorName))),
      titleCodes: uniqueValues(allEmployees.map((employee) => safeString(employee.titleCode))),
      hireYears: uniqueValues(
        allEmployees.map((employee) => {
          const parsed = employee.hireDate ? new Date(employee.hireDate) : null;
          return parsed && !Number.isNaN(parsed.getTime()) ? String(parsed.getUTCFullYear()) : "";
        })
      )
    }),
    [allEmployees]
  );

  const openEmployeeDetail = (employee: Employee) => {
    const supervisor = allEmployees.find(
      (candidate) => safeLower(candidate.fullName) === safeLower(employee.supervisorName)
    );
    const directReports = allEmployees.filter(
      (candidate) => safeLower(candidate.supervisorName) === safeLower(employee.fullName)
    );
    const relatedEmployees = allEmployees
      .filter(
        (candidate) =>
          candidate.id !== employee.id &&
          (safeString(candidate.employeeRegion) === safeString(employee.employeeRegion) ||
            safeString(candidate.titleCode) === safeString(employee.titleCode))
      )
      .slice(0, 10);
    setDetail({ employee, supervisor: supervisor ?? null, directReports, relatedEmployees });
  };

  const applyEmployeeChange = (updated: Employee) => {
    setAllEmployees((prev) => prev.map((employee) => (employee.id === updated.id ? updated : employee)));
    if (detail?.employee.id === updated.id) {
      openEmployeeDetail(updated);
    }
    onDataChange();
  };

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Employee directory</h3>
            <p>Search, filter, sort, and manage the workforce roster.</p>
          </div>
        </div>
        <div className="filters">
          <input
            placeholder="Search by name, email, title, supervisor, region..."
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, page: 1, search: event.target.value }))}
          />
          {[
            ["region", "regions", "All regions"],
            ["country", "countries", "All countries"],
            ["title", "titles", "All titles"],
            ["supervisor", "supervisors", "All supervisors"],
            ["titleCode", "titleCodes", "All title codes"],
            ["hireYear", "hireYears", "All hire years"]
          ].map(([field, optionKey, label]) => (
            <select
              key={field}
              value={filters[field as keyof EmployeeFilters] as string}
              onChange={(event) => setFilters((current) => ({ ...current, page: 1, [field]: event.target.value }))}
            >
              <option value="">{label}</option>
              {filterOptions[optionKey as keyof typeof filterOptions].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          ))}
          <select
            value={filters.sortBy}
            onChange={(event) =>
              setFilters((current) => ({ ...current, sortBy: event.target.value as EmployeeFilters["sortBy"] }))
            }
          >
            <option value="name">Sort: name</option>
            <option value="hireDate">Sort: hire date</option>
            <option value="region">Sort: region</option>
            <option value="title">Sort: title</option>
            <option value="tenure">Sort: tenure</option>
          </select>
          <select
            value={filters.sortDirection}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                sortDirection: event.target.value as EmployeeFilters["sortDirection"]
              }))
            }
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        <div className="table-actions">
          <button className="button button--primary" onClick={() => setEditTarget({})} type="button">
            New employee
          </button>
          <button
            className="button"
            disabled={!selectedIds.length}
            onClick={() => setDeleteTarget(allEmployees.find((employee) => employee.id === selectedIds[0]) ?? null)}
            type="button"
          >
            Bulk delete ({selectedIds.length})
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>Email</th>
                <th>Title</th>
                <th>Region</th>
                <th>Supervisor</th>
                <th>Country</th>
                <th>Title Code</th>
                <th>Hire Date</th>
                <th>Tenure</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pagedEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <input
                      checked={selectedIds.includes(employee.id)}
                      onChange={(event) =>
                        setSelectedIds((current) =>
                          event.target.checked
                            ? [...current, employee.id]
                            : current.filter((id) => id !== employee.id)
                        )
                      }
                      type="checkbox"
                    />
                  </td>
                  <td>{safeString(employee.fullName)}</td>
                  <td>{safeString(employee.email) || <span className="missing-badge">Missing</span>}</td>
                  <td>{safeString(employee.title) || <span className="missing-badge">Missing</span>}</td>
                  <td>{safeString(employee.employeeRegion) || <span className="missing-badge">Missing</span>}</td>
                  <td>{safeString(employee.supervisorName) || <span className="missing-badge">Missing</span>}</td>
                  <td>{safeString(employee.country) || <span className="missing-badge">Missing</span>}</td>
                  <td>{safeString(employee.titleCode) || <span className="missing-badge">Missing</span>}</td>
                  <td>{formatDate(employee.hireDate)}</td>
                  <td>{getTenureLabel(employee)}</td>
                  <td className="row-actions">
                    <button className="button button--ghost" onClick={() => openEmployeeDetail(employee)} type="button">
                      View
                    </button>
                    <button className="button" onClick={() => setEditTarget(employee)} type="button">
                      Edit
                    </button>
                    <button className="button button--danger" onClick={() => setDeleteTarget(employee)} type="button">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!pagedEmployees.length && !loading ? <div className="empty-state">No employees match the current filters.</div> : null}
        </div>

        <div className="pagination">
          <span>
            Page {currentPage} of {totalPages} • {filteredEmployees.length} total employees
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
        {loading ? <div className="empty-state">Loading employees...</div> : null}
        {error ? <div className="error-text">{error}</div> : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Bulk update selected</h3>
            <p>Region, supervisor, country, or title can be updated across many employees.</p>
          </div>
        </div>
        <div className="form-grid">
          {Object.entries(bulkFields).map(([field, value]) => (
            <label key={field}>
              <span>{field}</span>
              <input
                value={value}
                onChange={(event) => setBulkFields((current) => ({ ...current, [field]: event.target.value }))}
              />
            </label>
          ))}
          <button
            className="button button--primary"
            disabled={!selectedIds.length}
            onClick={async () => {
              const updates = Object.fromEntries(
                Object.entries(bulkFields).filter(([, value]) => !isMissing(value))
              ) as Partial<Pick<Employee, "employeeRegion" | "supervisorName" | "country" | "title">>;
              await api.bulkUpdate(selectedIds, updates);
              setAllEmployees((prev) =>
                prev.map((employee) =>
                  selectedIds.includes(employee.id) ? { ...employee, ...updates } : employee
                )
              );
              setBulkFields({ employeeRegion: "", supervisorName: "", country: "", title: "" });
              onDataChange();
            }}
            type="button"
          >
            Apply bulk update
          </button>
        </div>
      </section>

      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={editTarget?.id ? "Edit employee" : "Create employee"}
      >
        <EmployeeForm
          initialValue={editTarget ?? undefined}
          onSubmit={async (payload) => {
            if (editTarget?.id) {
              const updated = await api.updateEmployee(editTarget.id, payload);
              applyEmployeeChange(updated);
            } else {
              const created = await api.createEmployee(payload);
              setAllEmployees((prev) => [created, ...prev]);
              onDataChange();
            }
            setEditTarget(null);
          }}
          submitLabel={editTarget?.id ? "Save changes" : "Create employee"}
        />
      </Modal>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Employee details" width="wide">
        <EmployeeDrawer detail={detail} onClose={() => setDetail(null)} />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (selectedIds.length > 1 && deleteTarget && selectedIds.includes(deleteTarget.id)) {
            await api.bulkDelete(selectedIds);
            setAllEmployees((prev) => prev.filter((employee) => !selectedIds.includes(employee.id)));
            setSelectedIds([]);
          } else if (deleteTarget) {
            await api.deleteEmployee(deleteTarget.id);
            setAllEmployees((prev) => prev.filter((employee) => employee.id !== deleteTarget.id));
            setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
          }
          onDataChange();
        }}
        title="Delete employee"
        message={
          selectedIds.length > 1 && deleteTarget && selectedIds.includes(deleteTarget.id)
            ? `Are you sure you want to delete ${selectedIds.length} selected employees?`
            : `Are you sure you want to delete ${deleteTarget?.fullName ?? "this employee"}?`
        }
      />
    </div>
  );
}

const getTenureValue = (employee: Employee) => {
  if (!employee.hireDate) {
    return -1;
  }
  const parsed = new Date(employee.hireDate);
  if (Number.isNaN(parsed.getTime())) {
    return -1;
  }
  return Date.now() - parsed.getTime();
};
