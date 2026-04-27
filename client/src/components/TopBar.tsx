interface TopBarProps {
  adminKey: string;
  onAdminKeyChange: (value: string) => void;
}

export function TopBar({ adminKey, onAdminKeyChange }: TopBarProps) {
  return (
    <header className="topbar">
      <div>
        <p className="page-kicker">Workforce operations</p>
        <h2>Employee Directory and HR Control Center</h2>
      </div>
      <label className="admin-key">
        <span>Admin key</span>
        <input
          type="password"
          placeholder="Required for imports and edits"
          value={adminKey}
          onChange={(event) => onAdminKeyChange(event.target.value)}
        />
      </label>
    </header>
  );
}
