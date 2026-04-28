import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/api";
import { formatDate, getTenureLabel } from "../lib/format";
import type { DashboardSummary } from "../types";
import { ChartCard } from "../components/ChartCard";
import { StatCard } from "../components/StatCard";

const PIE_COLORS = [
  "#0f766e",
  "#2563eb",
  "#f97316",
  "#9333ea",
  "#dc2626",
  "#16a34a",
  "#ca8a04",
  "#0891b2",
  "#be123c",
  "#4f46e5",
];

interface DashboardPageProps {
  refreshToken: number;
}

export function DashboardPage({ refreshToken }: DashboardPageProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setSummary(null);
    api
      .getDashboard()
      .then(setSummary)
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Dashboard failed to load.")
      );
  }, [refreshToken]);

  if (error) {
    return <div className="error-text">{error}</div>;
  }

  if (!summary) {
    return <div className="empty-state">Loading dashboard...</div>;
  }

  const countryData = summary.employeesByCountry.slice(0, 10);
  const countryTotal = countryData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="page-grid">
      <section className="stat-grid">
        <StatCard label="Total employees" value={summary.totalEmployees} tone="accent" />
        <StatCard label="Total clients" value={summary.totalClients} />
        <StatCard label="Total projects" value={summary.totalProjects} />
        <StatCard label="Active projects" value={summary.activeProjects} />
        <StatCard label="Projects missing PO" value={summary.projectsMissingPoNumber} tone="warn" />
        <StatCard label="Clients missing manager" value={summary.clientsMissingManager} tone="warn" />
        <StatCard label="Regions tracked" value={summary.employeesByRegion.length} />
        <StatCard label="Countries tracked" value={summary.employeesByCountry.length} />
        <StatCard label="Missing data warnings" value={summary.missingDataWarnings.length} tone="warn" />
      </section>

      <ChartCard title="Employees by region" subtitle="Top workforce concentration">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={summary.employeesByRegion.slice(0, 8)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#0f766e" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Employees by country" subtitle="Global coverage snapshot">
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={countryData}
              dataKey="value"
              nameKey="label"
              cx="45%"
              cy="50%"
              outerRadius={100}
            >
              {countryData.map((entry, index) => (
                <Cell
                  key={`country-slice-${entry.label}`}
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                />
              ))}
            </Pie>

            <Tooltip
              formatter={(value: number, name: string) => {
                const percent =
                  countryTotal > 0
                    ? ((Number(value) / countryTotal) * 100).toFixed(1)
                    : "0.0";

                return [`${value} employees (${percent}%)`, name];
              }}
            />

            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              formatter={(value) => {
                const item = countryData.find((country) => country.label === value);
                return item ? `${value} (${item.value})` : value;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Newest hires">
        <ul className="stack-list">
          {summary.newestHires.map((employee) => (
            <li key={employee.id}>
              <strong>{employee.fullName}</strong>
              <span>
                {employee.title || "No title"} • {formatDate(employee.hireDate)}
              </span>
            </li>
          ))}
        </ul>
      </ChartCard>

      <ChartCard title="Longest-tenured employees">
        <ul className="stack-list">
          {summary.longestTenuredEmployees.map((employee) => (
            <li key={employee.id}>
              <strong>{employee.fullName}</strong>
              <span>
                {employee.title || "No title"} • {getTenureLabel(employee)}
              </span>
            </li>
          ))}
        </ul>
      </ChartCard>

      <ChartCard title="Largest supervisor teams">
        <ul className="stack-list">
          {summary.largestSupervisorTeams.map((team) => (
            <li key={team.supervisorName}>
              <strong>{team.supervisorName}</strong>
              <span>{team.teamSize} direct reports</span>
            </li>
          ))}
        </ul>
      </ChartCard>

      <ChartCard title="Warnings to clean up" subtitle="Data quality signals">
        <ul className="stack-list">
          {summary.missingDataWarnings.map((issue, index) => (
            <li key={`${issue.type}-${index}`}>
              <strong>{issue.entityName || issue.type}</strong>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      </ChartCard>
    </div>
  );
}
