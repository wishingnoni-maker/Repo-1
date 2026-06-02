import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { ToastProvider } from "./components/ToastProvider";
import { ClientsPage } from "./pages/ClientsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DataQualityPage } from "./pages/DataQualityPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { ImportPage } from "./pages/ImportPage";
import { OrgViewPage } from "./pages/OrgViewPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TimeTrackingPage } from "./pages/TimeTrackingPage";

export default function App() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("workforceHub.sidebarCollapsed") === "true";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("workforceHub.sidebarCollapsed", String(sidebarCollapsed));
    }
  }, [sidebarCollapsed]);

  const handleDataChange = () => setRefreshToken((current) => current + 1);

  return (
    <ToastProvider>
      <BrowserRouter>
        <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
          <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((current) => !current)} />
          <main className="main-shell">
            <TopBar />
            <Routes>
              <Route element={<Navigate replace to="/projects" />} path="/" />
              <Route element={<DashboardPage refreshToken={refreshToken} />} path="/dashboard" />
              <Route
                element={<EmployeesPage refreshToken={refreshToken} onDataChange={handleDataChange} />}
                path="/employees"
              />
              <Route
                element={
                  <ImportPage onImportSuccess={handleDataChange} />
                }
                path="/import"
              />
              <Route
                element={<ClientsPage refreshToken={refreshToken} onDataChange={handleDataChange} />}
                path="/clients"
              />
              <Route
                element={<ProjectsPage refreshToken={refreshToken} onDataChange={handleDataChange} />}
                path="/projects"
              />
              <Route
                element={<TimeTrackingPage refreshToken={refreshToken} onDataChange={handleDataChange} />}
                path="/time-tracking"
              />
              <Route element={<OrgViewPage />} path="/org" />
              <Route element={<DataQualityPage />} path="/data-quality" />
              <Route element={<ReportsPage />} path="/reports" />
              <Route element={<SettingsPage />} path="/settings" />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}
