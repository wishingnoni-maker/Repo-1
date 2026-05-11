import { closeDbPool } from "../src/db/pool.js";
import { TimeEntryService } from "../src/services/timeEntryService.js";
import { loadScriptEnv } from "./databaseUtils.js";

loadScriptEnv();

try {
  const service = new TimeEntryService();
  const [employees, projects, existingEntries] = await Promise.all([
    service.getEmployeeOptions(),
    service.getEligibleProjectOptions(),
    service.getAll()
  ]);

  const selectedEmployees = employees.slice(0, 5);
  const selectedProjects = projects.slice(0, 5);

  if (!selectedEmployees.length || !selectedProjects.length) {
    throw new Error("No employees or eligible projects available. Run db:seed:timesheet-demo-projects first if needed.");
  }

  const existingKeys = new Set(
    existingEntries.map((entry) => `${entry.employeeId}:${entry.projectId}:${entry.workDate}:${entry.workCategory}:${entry.notes}`)
  );

  const created: string[] = [];
  const today = new Date();
  const offsets = [0, 1, 3, 5, 7, 8, 10, 12];

  for (let index = 0; index < offsets.length; index += 1) {
    const employee = selectedEmployees[index % selectedEmployees.length];
    const project = selectedProjects[index % selectedProjects.length];
    const workDate = new Date(today);
    workDate.setUTCDate(today.getUTCDate() - offsets[index]);
    const workDateLabel = workDate.toISOString().slice(0, 10);
    const workCategory = index % 4 === 0 ? "Internal Meeting" : index % 3 === 0 ? "Support" : "Client Work";
    const billable = workCategory === "Client Work" || workCategory === "Support";
    const notes = `Demo seed entry ${index + 1}`;
    const key = `${employee.id}:${project.id}:${workDateLabel}:${workCategory}:${notes}`;

    if (existingKeys.has(key)) {
      continue;
    }

    await service.create({
      employeeId: employee.id,
      projectId: project.id,
      clientId: project.clientId,
      workDate: workDateLabel,
      hours: index % 2 === 0 ? 6.5 : 3.5,
      workCategory,
      billable,
      notes
    });
    created.push(key);
    existingKeys.add(key);
  }

  console.log(`Created ${created.length} demo time entries.`);
} finally {
  await closeDbPool();
}
