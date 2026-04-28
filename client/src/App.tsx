import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { ClientsPage } from "./pages/ClientsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DataQualityPage } from "./pages/DataQualityPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { ImportPage } from "./pages/ImportPage";
import { OrgViewPage } from "./pages/OrgViewPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  const [refreshToken, setRefreshToken] = useState(0);
  const handleDataChange = () => setRefreshToken((current) => current + 1);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />
        <main className="main-shell">
          <TopBar />
          <Routes>
            <Route element={<DashboardPage refreshToken={refreshToken} />} path="/" />
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
            <Route element={<OrgViewPage />} path="/org" />
            <Route element={<DataQualityPage />} path="/data-quality" />
            <Route element={<ReportsPage />} path="/reports" />
            <Route element={<SettingsPage />} path="/settings" />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
