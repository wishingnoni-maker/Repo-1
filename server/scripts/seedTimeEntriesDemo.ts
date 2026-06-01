import { closeDbPool } from "../src/db/pool.js";
import { TimesheetService } from "../src/services/timesheetService.js";
import { loadScriptEnv } from "./databaseUtils.js";

loadScriptEnv();

const mondayOf = (value: Date) => {
  const parsed = new Date(value);
  const day = parsed.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  parsed.setUTCDate(parsed.getUTCDate() - offset);
  return parsed.toISOString().slice(0, 10);
};

const addDays = (value: string, days: number) => {
  const parsed = new Date(value);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

try {
  const service = new TimesheetService();
  const [employees, projects] = await Promise.all([
    service.getEmployeeOptions(),
    service.getProjectOptions()
  ]);

  const selectedEmployees = employees.slice(0, 3);
  const selectedProjects = projects.filter((project) => project.clientId).slice(0, 3);

  if (!selectedEmployees.length || !selectedProjects.length) {
    throw new Error("No employees or eligible projects available. Run db:seed:timesheet-demo-projects first if needed.");
  }

  const currentWeek = mondayOf(new Date());
  const previousWeek = addDays(currentWeek, -7);
  const weekStarts = [currentWeek, previousWeek];

  let seededWeeks = 0;

  for (const [employeeIndex, employee] of selectedEmployees.entries()) {
    for (const [weekIndex, weekStart] of weekStarts.entries()) {
      const project = selectedProjects[(employeeIndex + weekIndex) % selectedProjects.length];
      const supportProject = selectedProjects[(employeeIndex + weekIndex + 1) % selectedProjects.length];

      await service.saveWeek({
        employeeId: employee.id,
        weekStart,
        status: weekIndex === 0 ? "draft" : "submitted",
        showWeekend: employeeIndex === 0,
        rows: [
          {
            clientId: project.clientId,
            projectId: project.id,
            workCategory: "Client Work",
            billable: true,
            notes: `Demo weekly timesheet row ${employeeIndex + 1}-${weekIndex + 1}`,
            holidayOrWeekendReason: employeeIndex === 0 ? "Weekend cutover support" : "",
            hours: {
              mon: 4,
              tue: 5,
              wed: 6,
              thu: 4.5,
              fri: 3,
              sat: employeeIndex === 0 ? 2 : 0,
              sun: 0
            }
          },
          {
            clientId: supportProject.clientId,
            projectId: supportProject.id,
            workCategory: "Project Management",
            billable: true,
            notes: "Client coordination and status updates",
            holidayOrWeekendReason: "",
            hours: {
              mon: 1.5,
              tue: 0,
              wed: 1,
              thu: 0,
              fri: 1,
              sat: 0,
              sun: 0
            }
          },
          {
            clientId: project.clientId,
            projectId: project.id,
            workCategory: "Admin",
            billable: false,
            notes: "Internal admin and timesheet upkeep",
            holidayOrWeekendReason: "",
            hours: {
              mon: 0.5,
              tue: 0.5,
              wed: 0,
              thu: 0.5,
              fri: 0,
              sat: 0,
              sun: 0
            }
          }
        ]
      });

      seededWeeks += 1;
    }
  }

  console.log(`Seeded ${seededWeeks} weekly demo timesheets.`);
} finally {
  await closeDbPool();
}
