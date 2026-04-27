# Employee Directory and Workforce Management App

Full-stack CRUD application for importing employee records from Excel, browsing a searchable directory, reviewing workforce analytics, exploring supervisor hierarchies, and exporting HR/data-quality reports.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: Azure SQL compatible schema with local JSON fallback
- Excel parsing: `xlsx`
- Charts: `recharts`

## Project Structure

```text
/client      React admin UI
/server      Express API, import pipeline, repository layer
/database    Azure SQL schema
/sample-data CSV seed for testing imports
README.md
.env.example
```

## Features

- Excel import with normalized header matching and row-level validation
- Import summary showing totals, duplicates, skipped rows, and missing required fields
- Employee directory with pagination, search, filters, and sort options
- Single-record create, edit, delete, plus bulk delete and bulk update
- Employee detail drawer with supervisor info, direct reports, and related employees
- Dashboard with employee counts, charts, newest hires, longest tenure, and team size stats
- Org view grouped by supervisor name, including unmatched supervisor flags
- Data quality page with issue detection and CSV export
- CSV export for all employees, filtered employees, data-quality issues, and supervisor reports
- `ADMIN_KEY` protection for import and mutating/destructive actions

## Local Setup

1. Install dependencies from the repo root:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env
```

3. Optional: preload sample JSON data for local mode:

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

## Importing Excel

1. Go to the `Import Excel` page.
2. Enter the configured `ADMIN_KEY`.
3. Upload an `.xlsx` or `.xls` workbook.
4. The API reads the first worksheet and maps headers like:
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
5. Set `Update existing employees` if matching emails should overwrite existing records.

Use [sample-data/employees-sample.csv](/Users/govindkishan/Documents/Codex/2026-04-27/files-mentioned-by-the-user-employee/sample-data/employees-sample.csv) as a starter dataset. You can open it in Excel and save it as `.xlsx` if you want a workbook for upload testing.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend port |
| `CLIENT_URL` | Allowed frontend origin(s) |
| `ADMIN_KEY` | Required for import/create/update/delete/bulk operations |
| `DATA_PROVIDER` | `json` or `sql` |
| `JSON_DATA_PATH` | Local file path for JSON persistence |
| `AZURE_SQL_*` | Azure SQL connection settings |

## Azure SQL Setup

1. Provision an Azure SQL Database and allow your app/service IPs.
2. Run [database/schema.sql](/Users/govindkishan/Documents/Codex/2026-04-27/files-mentioned-by-the-user-employee/database/schema.sql) against the database.
3. Set:

```env
DATA_PROVIDER=sql
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=your-database
AZURE_SQL_USER=your-user
AZURE_SQL_PASSWORD=your-password
AZURE_SQL_ENCRYPT=true
AZURE_SQL_TRUST_SERVER_CERTIFICATE=false
```

4. Restart the server.

## API Routes

- `POST /api/import/employees`
- `GET /api/employees`
- `GET /api/employees/:id`
- `POST /api/employees`
- `PUT /api/employees/:id`
- `DELETE /api/employees/:id`
- `POST /api/employees/bulk-delete`
- `POST /api/employees/bulk-update`
- `GET /api/dashboard/summary`
- `GET /api/org/supervisors`
- `GET /api/data-quality`
- `GET /api/export/employees`
- `GET /api/export/data-quality`
- `GET /api/export/supervisor-report`

## Azure Deployment Notes

### Backend to Azure App Service

1. Create an Azure App Service for Node.js.
2. Add environment variables from `.env`.
3. Ensure `DATA_PROVIDER=sql` for production unless you intentionally want file storage.
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

- The local JSON repository is intentionally simple and useful for demos, local development, and environments where Azure SQL is not configured yet.
- SQL mode uses the same normalized employee shape and route contract as JSON mode.
- The sample dataset intentionally includes a few data-quality issues to exercise the warning screens.
