import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { DashboardPage } from "./pages/DashboardPage";
import { DataQualityPage } from "./pages/DataQualityPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { ImportPage } from "./pages/ImportPage";
import { OrgViewPage } from "./pages/OrgViewPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  const [adminKey, setAdminKey] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />
        <main className="main-shell">
          <TopBar adminKey={adminKey} onAdminKeyChange={setAdminKey} />
          <Routes>
            <Route element={<DashboardPage refreshToken={refreshToken} />} path="/" />
            <Route element={<EmployeesPage adminKey={adminKey} refreshToken={refreshToken} />} path="/employees" />
            <Route
              element={
                <ImportPage
                  adminKey={adminKey}
                  onImportSuccess={() => setRefreshToken((current) => current + 1)}
                />
              }
              path="/import"
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
