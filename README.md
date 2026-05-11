# Workforce Hub

Full-stack operations hub for employees, clients, and projects with import, CRUD, analytics, org structure, data quality, and export workflows.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL with JSON fallback kept for local/demo safety
- Excel parsing: `xlsx`
- Charts: `recharts`

## Project Structure

```text
/client      React admin UI
/server      Express API, import pipeline, repository layer
/database    Legacy schema/reference assets
/server/database PostgreSQL schema
/sample-data CSV seed for testing imports
README.md
.env.example
```

## Features

- Excel/CSV import with normalized header matching and row-level validation
- Import summary showing totals, duplicates, skipped rows, and missing required fields
- Employee, client, and project directory workflows with pagination, search, filters, and sort options
- Single-record create, edit, delete, plus bulk delete and bulk update
- Detail drawers plus edit/delete flows across employees, clients, and projects
- Dashboard with employee, client, and project counts plus supporting charts and summaries
- Org view grouped by supervisor name, including unmatched supervisor flags
- Data quality page with employee/client/project issue detection and CSV export
- CSV export for employees, clients, projects, project financials, data-quality issues, and supervisor reports
- PostgreSQL seed and verification scripts using the provided source CSV files

## Local Setup

1. Install dependencies from the repo root:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env
```

3. Optional JSON fallback mode:

```bash
cp server/data/employees.sample.json server/data/employees.json
```

4. Start the backend:

```bash
npm run dev:server
```

5. Start the frontend in a separate terminal:

```bash
npm run dev:client
```

6. Open the frontend at [http://localhost:5173](http://localhost:5173). The API defaults to [http://localhost:4000/api](http://localhost:4000/api).

## PostgreSQL Setup

The backend supports PostgreSQL when:

- `DATA_PROVIDER=postgres`, or
- `DATA_PROVIDER` is unset and `DATABASE_URL` is provided

1. Start a local PostgreSQL instance.
   If Docker is available:

```bash
docker compose up -d
```

2. Apply the schema:

```bash
cd server
npm run db:schema
```

3. Seed from the provided source CSV files:

```bash
npm run db:seed
```

4. Verify preserved counts and dashboard-equivalent summary values:

```bash
npm run db:verify
```

5. To reset and reseed:

```bash
npm run db:reset
```

If `DATA_PROVIDER=json`, the app continues to use JSON persistence from `server/data/*.json` even if a `DATABASE_URL` value is present.

## Importing Excel / CSV

1. Go to the `Import Excel` page.
2. Choose `Employees`, `Clients`, or `Projects`.
3. Upload a `.csv`, `.xlsx`, or `.xls` file.
4. The API reads the first worksheet or CSV and maps headers like:
   - `User First Name`
   - `User Last Name`
   - `Name`
   - `User Email`
   - `Title`
   - `Employee Region`
   - `User Supervisor Name`
   - `Employee Cell`
   - `Country`
   - `Title Code`
   - `Hire Date`
   - `Client Name`
   - `Project Name`
   - `Budget Cost`
   - `Expense Budget (Project Currency)`
5. The import writes into PostgreSQL when `DATABASE_URL` is configured, otherwise it writes into the JSON fallback files.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend port |
| `CLIENT_URL` | Allowed frontend origin(s) |
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_SSL` | Set `true` for managed Postgres providers that require SSL |
| `DATA_PROVIDER` | `json`, `postgres`, or legacy `sql` |
| `JSON_DATA_PATH` | Local file path for JSON persistence |
| `EMPLOYEE_SOURCE_CSV` | Employee seed source CSV path |
| `CLIENT_SOURCE_CSV` | Client seed source CSV path |
| `PROJECT_SOURCE_CSV` | Project seed source CSV path |
| `AZURE_SQL_*` | Legacy Azure SQL connection settings |

## PostgreSQL Schema

Run [server/database/schema.sql](/Users/govindkishan/Documents/Codex/2026-04-27/files-mentioned-by-the-user-employee/server/database/schema.sql) against your PostgreSQL database. The schema includes:

- `employees`
- `clients`
- `projects`
- indexes for the main filter/sort fields
- a shared `updated_at` trigger

## API Routes

- `POST /api/import/employees`
- `POST /api/import/clients`
- `POST /api/import/projects`
- `GET /api/employees`
- `GET /api/employees/:id`
- `POST /api/employees`
- `PUT /api/employees/:id`
- `DELETE /api/employees/:id`
- `POST /api/employees/bulk-delete`
- `POST /api/employees/bulk-update`
- `GET /api/clients`
- `GET /api/clients/:id`
- `POST /api/clients`
- `PUT /api/clients/:id`
- `DELETE /api/clients/:id`
- `GET /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/dashboard/summary`
- `GET /api/org/supervisors`
- `GET /api/data-quality`
- `GET /api/export/employees`
- `GET /api/export/clients`
- `GET /api/export/projects`
- `GET /api/export/project-financials`
- `GET /api/export/data-quality`
- `GET /api/export/client-data-quality`
- `GET /api/export/project-data-quality`
- `GET /api/export/supervisor-report`

## Azure PostgreSQL Deployment Notes

1. Create an Azure Database for PostgreSQL Flexible Server or use your team-provided PostgreSQL instance.
2. Set:

```env
DATA_PROVIDER=postgres
DATABASE_URL=postgresql://username:password@hostname.postgres.database.azure.com:5432/workforce_hub?sslmode=require
```

3. Do not use `localhost` in Azure App Service. `localhost` inside Azure points to the app container itself, not your laptop or a managed database server.

4. If your PostgreSQL server requires SSL, set either:

```env
DATABASE_SSL=true
```

or:

```env
PGSSLMODE=require
```

5. Run the schema and one-time seed against the production database.
6. Deploy the backend. The existing frontend can keep using the same `VITE_API_BASE_URL`.

## Verify Azure App Service Is Using Neon PostgreSQL

1. Confirm Azure App Service environment variables:

```env
DATA_PROVIDER=postgres
DATABASE_URL=postgresql://<username>:<password>@<neon-host>/<database>?sslmode=require
DATABASE_SSL=true
NODE_ENV=production
SCM_DO_BUILD_DURING_DEPLOYMENT=false
```

2. Restart the App Service.

3. Test:

[https://workforce-hub-api-h4d8caavcxhrhcdh.canadacentral-01.azurewebsites.net/api/health](https://workforce-hub-api-h4d8caavcxhrhcdh.canadacentral-01.azurewebsites.net/api/health)

Expected:

```json
{"ok":true}
```

4. Test:

[https://workforce-hub-api-h4d8caavcxhrhcdh.canadacentral-01.azurewebsites.net/api/system/status](https://workforce-hub-api-h4d8caavcxhrhcdh.canadacentral-01.azurewebsites.net/api/system/status)

Expected:

- `dataProvider=postgres`
- `hasDatabaseUrl=true`
- `databaseSsl=true`
- `postgresConnected=true`
- `counts.employees=39`
- `counts.clients=187`
- `counts.projects=708`

5. Test:

[https://workforce-hub-api-h4d8caavcxhrhcdh.canadacentral-01.azurewebsites.net/api/dashboard/summary](https://workforce-hub-api-h4d8caavcxhrhcdh.canadacentral-01.azurewebsites.net/api/dashboard/summary)

Expected:

- `totalEmployees=39`
- `totalClients=187`
- `totalProjects=708`

6. Prove Neon is the source of truth:

In the Neon SQL Editor, run:

```sql
UPDATE employees
SET title = 'NEON VERIFICATION TEST'
WHERE email = 'akelleher@trascent.com';
```

Then call:

`GET /api/employees`

Confirm the changed title appears.

Then undo it:

```sql
UPDATE employees
SET title = 'Engagement Manager'
WHERE email = 'akelleher@trascent.com';
```

## Azure Deployment Notes

### Backend to Azure App Service

1. Create an Azure App Service for Node.js.
2. Add environment variables from `.env`.
3. Set `DATABASE_URL` for PostgreSQL-backed production.
4. Build command:

```bash
npm install
npm run build --workspace server
```

5. Startup command:

```bash
npm run start --workspace server
```

### Frontend Deployment

1. Build the client:

```bash
npm run build --workspace client
```

2. Deploy `client/dist` to Azure Static Web Apps, Azure Storage Static Website hosting, or a frontend hosting platform.
3. Set `VITE_API_BASE_URL` during build to the deployed backend URL, for example:

```env
VITE_API_BASE_URL=https://your-api.azurewebsites.net/api
```

### Single-App Option

If you want one Azure App Service deployment, you can build the client separately and serve `client/dist` behind a reverse proxy or static middleware layer. The current repo keeps the frontend and backend decoupled for simpler local development and Azure service separation.

## Notes

- PostgreSQL mode is designed to preserve the existing API contract and frontend behavior.
- The local JSON repository is still available as a fallback/reference path while the DB rollout is being verified.
- The seed/verify scripts expect the provided employee, client, and project CSV files unless you override the paths with env vars.

## Time Tracking Module

The app includes a new `Time Tracking` module at `/time-tracking`.

### What it uses

- Employees come from the existing `employees` table.
- Clients come from the existing `clients` table.
- Projects come from the existing `projects` table.
- Time entries are stored in the new `time_entries` table.

### Key API routes

- `GET /api/time-entries`
- `POST /api/time-entries`
- `GET /api/time-entries/:id`
- `PUT /api/time-entries/:id`
- `DELETE /api/time-entries/:id`
- `GET /api/time-entries/summary`
- `GET /api/time-entries/project-options`
- `GET /api/time-entries/employee-options`
- `GET /api/time-entries/export`

### Demo and setup scripts

Apply the schema:

```bash
npm run db:schema --workspace server
```

Mark a small recent set of projects as eligible for timesheet demos:

```bash
npm run db:seed:timesheet-demo-projects --workspace server
```

There is also an alias:

```bash
npm run db:seed:timesheet-demo --workspace server
```

Seed sample time entries for the current week/month:

```bash
npm run db:seed:time-entries-demo --workspace server
```

### Local verification

With PostgreSQL mode enabled:

```bash
DATA_PROVIDER=postgres npm start --workspace server
```

Then test:

- `GET /api/time-entries/project-options`
- `GET /api/time-entries/employee-options`
- `GET /api/time-entries`
- `GET /api/time-entries/summary`

### Important behavior

- The project picker only shows projects that are recent or active-ish for the last 5 years.
- Demo scripts never run automatically on startup.
- Partial `PUT` updates are safe and only modify fields that are actually sent.
