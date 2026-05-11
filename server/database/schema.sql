CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT,
  last_name TEXT,
  full_name TEXT NOT NULL,
  email TEXT,
  title TEXT,
  employee_region TEXT,
  supervisor_name TEXT,
  employee_cell TEXT,
  country TEXT,
  title_code TEXT,
  hire_date DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  status TEXT,
  invoice_currency TEXT,
  client_contact TEXT,
  client_manager TEXT,
  client_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name TEXT NOT NULL,
  project_estimated_hrs NUMERIC NULL,
  project_status TEXT,
  project_currency TEXT,
  project_manager TEXT,
  project_manager_email TEXT,
  project_start_date DATE NULL,
  project_end_date DATE NULL,
  project_description TEXT,
  budget_hours NUMERIC NULL,
  budget_cost NUMERIC NULL,
  expense_budget NUMERIC NULL,
  project_region TEXT,
  po_number TEXT,
  project_sold_by TEXT,
  number_of_resources NUMERIC NULL,
  number_of_work_weeks NUMERIC NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id UUID NULL REFERENCES clients(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  hours NUMERIC(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  work_category TEXT NOT NULL DEFAULT 'Client Work',
  billable BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_full_name ON employees(full_name);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_employee_region ON employees(employee_region);
CREATE INDEX IF NOT EXISTS idx_employees_supervisor_name ON employees(supervisor_name);

CREATE INDEX IF NOT EXISTS idx_clients_client_name ON clients(client_name);
CREATE INDEX IF NOT EXISTS idx_clients_client_manager ON clients(client_manager);

CREATE INDEX IF NOT EXISTS idx_projects_project_name ON projects(project_name);
CREATE INDEX IF NOT EXISTS idx_projects_project_status ON projects(project_status);
CREATE INDEX IF NOT EXISTS idx_projects_project_region ON projects(project_region);
CREATE INDEX IF NOT EXISTS idx_projects_project_manager ON projects(project_manager);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_id ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_client_id ON time_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_work_date ON time_entries(work_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_billable ON time_entries(billable);
CREATE INDEX IF NOT EXISTS idx_time_entries_created_at ON time_entries(created_at);

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employees_set_updated_at ON employees;
CREATE TRIGGER employees_set_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS clients_set_updated_at ON clients;
CREATE TRIGGER clients_set_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS projects_set_updated_at ON projects;
CREATE TRIGGER projects_set_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS time_entries_set_updated_at ON time_entries;
CREATE TRIGGER time_entries_set_updated_at
BEFORE UPDATE ON time_entries
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
