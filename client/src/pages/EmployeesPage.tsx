import { useEffect, useMemo, useState } from "react";
import { EmployeeDrawer } from "../components/EmployeeDrawer";
import { EmployeeForm } from "../components/EmployeeForm";
import { api } from "../lib/api";
import { formatDate, getTenureLabel, uniqueValues } from "../lib/format";
import type { Employee, EmployeeDetailResponse, EmployeeListResponse, Filters } from "../types";

const defaultFilters: Filters = {
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
  adminKey: string;
  refreshToken: number;
}

export function EmployeesPage({ adminKey, refreshToken }: EmployeesPageProps) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [response, setResponse] = useState<EmployeeListResponse | null>(null);
  const [detail, setDetail] = useState<EmployeeDetailResponse | null>(null);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [bulkFields, setBulkFields] = useState({
    employeeRegion: "",
    supervisorName: "",
    country: "",
    title: ""
  });

  const loadEmployees = async () => {
    const [paged, full] = await Promise.all([
      api.getEmployees(filters),
      api.getEmployees({ ...filters, page: 1, pageSize: 5000 })
    ]);
    setResponse(paged);
    setAllEmployees(full.data);
  };

  useEffect(() => {
    loadEmployees().catch(console.error);
  }, [filters, refreshToken]);

  const filterOptions = useMemo(
    () => ({
      regions: uniqueValues(allEmployees.map((employee) => employee.employeeRegion)),
      countries: uniqueValues(allEmployees.map((employee) => employee.country)),
      titles: uniqueValues(allEmployees.map((employee) => employee.title)),
      supervisors: uniqueValues(allEmployees.map((employee) => employee.supervisorName)),
      titleCodes: uniqueValues(allEmployees.map((employee) => employee.titleCode)),
      hireYears: uniqueValues(
        allEmployees.map((employee) => (employee.hireDate ? new Date(employee.hireDate).getUTCFullYear().toString() : ""))
      )
    }),
    [allEmployees]
  );

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
            ["region", "regions"],
            ["country", "countries"],
            ["title", "titles"],
            ["supervisor", "supervisors"],
            ["titleCode", "titleCodes"],
            ["hireYear", "hireYears"]
          ].map(([field, optionKey]) => (
            <select
              key={field}
              value={filters[field as keyof Filters] as string}
              onChange={(event) =>
                setFilters((current) => ({ ...current, page: 1, [field]: event.target.value }))
              }
            >
              <option value="">{field}</option>
              {filterOptions[optionKey as keyof typeof filterOptions].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          ))}
          <select
            value={filters.sortBy}
            onChange={(event) => setFilters((current) => ({ ...current, sortBy: event.target.value as Filters["sortBy"] }))}
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
              setFilters((current) => ({ ...current, sortDirection: event.target.value as Filters["sortDirection"] }))
            }
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        <div className="table-actions">
          <button className="button button--primary" onClick={() => setEditTarget({} as Employee)} type="button">
            New employee
          </button>
          <button
            className="button"
            disabled={!selectedIds.length}
            onClick={async () => {
              await api.bulkDelete(selectedIds, adminKey);
              setSelectedIds([]);
              await loadEmployees();
            }}
            type="button"
          >
            Bulk delete
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
              {response?.data.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <input
                      checked={selectedIds.includes(employee.id)}
                      onChange={(event) =>
                        setSelectedIds((current) =>
                          event.target.checked ? [...current, employee.id] : current.filter((id) => id !== employee.id)
                        )
                      }
                      type="checkbox"
                    />
                  </td>
                  <td>{employee.fullName}</td>
                  <td>{employee.email}</td>
                  <td>{employee.title}</td>
                  <td>{employee.employeeRegion}</td>
                  <td>{employee.supervisorName}</td>
                  <td>{employee.country}</td>
                  <td>{employee.titleCode}</td>
                  <td>{formatDate(employee.hireDate)}</td>
                  <td>{getTenureLabel(employee)}</td>
                  <td className="row-actions">
                    <button
                      className="button button--ghost"
                      onClick={async () => setDetail(await api.getEmployee(employee.id))}
                      type="button"
                    >
                      View
                    </button>
                    <button className="button" onClick={() => setEditTarget(employee)} type="button">
                      Edit
                    </button>
                    <button
                      className="button button--danger"
                      onClick={async () => {
                        await api.deleteEmployee(employee.id, adminKey);
                        await loadEmployees();
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!response?.data.length ? <div className="empty-state">No employees match the current filters.</div> : null}
        </div>

        <div className="pagination">
          <span>
            Page {response?.page ?? 1} of {response?.totalPages ?? 1} • {response?.total ?? 0} total employees
          </span>
          <div className="pagination__actions">
            <button
              className="button"
              disabled={(response?.page ?? 1) <= 1}
              onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
              type="button"
            >
              Previous
            </button>
            <button
              className="button"
              disabled={(response?.page ?? 1) >= (response?.totalPages ?? 1)}
              onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
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
              <input value={value} onChange={(event) => setBulkFields((current) => ({ ...current, [field]: event.target.value }))} />
            </label>
          ))}
          <button
            className="button button--primary"
            disabled={!selectedIds.length}
            onClick={async () => {
              const updates = Object.fromEntries(Object.entries(bulkFields).filter(([, value]) => value.trim()));
              await api.bulkUpdate(selectedIds, updates, adminKey);
              setBulkFields({
                employeeRegion: "",
                supervisorName: "",
                country: "",
                title: ""
              });
              await loadEmployees();
            }}
            type="button"
          >
            Apply bulk update
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>{editTarget?.id ? "Edit employee" : "Create employee"}</h3>
            <p>Manual record maintenance with the same normalized fields used by import.</p>
          </div>
        </div>
        <EmployeeForm
          initialValue={editTarget ?? undefined}
          onSubmit={async (payload) => {
            if (editTarget?.id) {
              await api.updateEmployee(editTarget.id, payload, adminKey);
            } else {
              await api.createEmployee(payload, adminKey);
            }
            setEditTarget(null);
            await loadEmployees();
          }}
          submitLabel={editTarget?.id ? "Save changes" : "Create employee"}
        />
      </section>

      <EmployeeDrawer detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
