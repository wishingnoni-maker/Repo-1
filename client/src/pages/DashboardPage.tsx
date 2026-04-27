import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";
import { formatDate, getTenureLabel } from "../lib/format";
import type { DashboardSummary } from "../types";
import { ChartCard } from "../components/ChartCard";
import { StatCard } from "../components/StatCard";

interface DashboardPageProps {
  refreshToken: number;
}

export function DashboardPage({ refreshToken }: DashboardPageProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    api.getDashboard().then(setSummary).catch(console.error);
  }, [refreshToken]);

  if (!summary) {
    return <div className="empty-state">Loading dashboard...</div>;
  }

  return (
    <div className="page-grid">
      <section className="stat-grid">
        <StatCard label="Total employees" value={summary.totalEmployees} tone="accent" />
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
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={summary.employeesByCountry.slice(0, 6)} dataKey="value" nameKey="label" outerRadius={100} fill="#f97316" />
            <Tooltip />
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
              <strong>{issue.employeeName || issue.type}</strong>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      </ChartCard>
    </div>
  );
}
