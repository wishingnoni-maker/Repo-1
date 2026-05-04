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

The backend now supports PostgreSQL when `DATABASE_URL` is set.

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

If `DATABASE_URL` is not set, the app continues to use JSON persistence from `server/data/*.json`.

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
DATABASE_URL=postgresql://username:password@hostname:5432/workforce_hub
```

3. If your PostgreSQL server requires SSL, set either:

```env
DATABASE_SSL=true
```

or:

```env
PGSSLMODE=require
```

4. Run the schema and one-time seed against the production database.
5. Deploy the backend. The existing frontend can keep using the same `VITE_API_BASE_URL`.

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
