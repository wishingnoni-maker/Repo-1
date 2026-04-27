import type {
  DashboardSummary,
  DataQualityIssue,
  Employee,
  EmployeeDetailResponse,
  EmployeeListResponse,
  Filters,
  ImportSummary,
  OrgGroup
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  return searchParams.toString();
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed." }));
    throw new Error(error.message ?? "Request failed.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  getEmployees: (filters: Filters) =>
    request<EmployeeListResponse>(
      `/employees?${buildQuery({
        ...filters
      })}`
    ),

  getEmployee: (id: string) => request<EmployeeDetailResponse>(`/employees/${id}`),

  createEmployee: (payload: Partial<Employee>, adminKey: string) =>
    request<Employee>("/employees", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey
      },
      body: JSON.stringify(payload)
    }),

  updateEmployee: (id: string, payload: Partial<Employee>, adminKey: string) =>
    request<Employee>(`/employees/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey
      },
      body: JSON.stringify(payload)
    }),

  deleteEmployee: (id: string, adminKey: string) =>
    request<void>(`/employees/${id}`, {
      method: "DELETE",
      headers: {
        "x-admin-key": adminKey
      }
    }),

  bulkDelete: (ids: string[], adminKey: string) =>
    request<{ deletedCount: number }>("/employees/bulk-delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey
      },
      body: JSON.stringify({ ids })
    }),

  bulkUpdate: (
    ids: string[],
    updates: Partial<Pick<Employee, "employeeRegion" | "supervisorName" | "country" | "title">>,
    adminKey: string
  ) =>
    request<{ updatedCount: number }>("/employees/bulk-update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey
      },
      body: JSON.stringify({ ids, updates })
    }),

  importEmployees: (file: File, updateExisting: boolean, adminKey: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("updateExisting", String(updateExisting));

    return request<ImportSummary>("/import/employees", {
      method: "POST",
      headers: {
        "x-admin-key": adminKey
      },
      body: formData
    });
  },

  getDashboard: () => request<DashboardSummary>("/dashboard/summary"),
  getDataQuality: () => request<DataQualityIssue[]>("/data-quality"),
  getOrgGroups: (region?: string, country?: string) =>
    request<OrgGroup[]>(
      `/org/supervisors?${buildQuery({
        region,
        country
      })}`
    ),
  exportUrl: (path: string, params?: Record<string, string | number | undefined>) =>
    `${API_BASE}${path}${params ? `?${buildQuery(params)}` : ""}`
};
