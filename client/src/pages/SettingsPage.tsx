export function SettingsPage() {
  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Settings</h3>
            <p>Environment-driven configuration notes for local JSON mode and Azure SQL mode.</p>
          </div>
        </div>
        <div className="settings-copy">
          <p>
            Use the root <code>.env</code> file to define the data provider and any future Azure SQL credentials.
          </p>
          <p>
            Local development defaults to JSON storage at <code>server/data/employees.json</code>. Switching
            <code>DATA_PROVIDER=sql</code> enables the Azure SQL-compatible repository layer.
          </p>
        </div>
      </section>
    </div>
  );
}
