import { closeDbPool } from "../src/db/pool.js";
import { ProjectAssignmentService } from "../src/services/projectAssignmentService.js";
import { TimeTrackingService } from "../src/services/timeTrackingService.js";
import { loadScriptEnv } from "./databaseUtils.js";

loadScriptEnv();

try {
  const trackingService = new TimeTrackingService();
  const assignmentService = new ProjectAssignmentService();

  const [employees, projects] = await Promise.all([
    trackingService.getEmployeeOptions(),
    trackingService.getProjectRows({ lastFiveYearsOnly: true })
  ]);

  const selectedEmployees = employees.slice(0, 8);
  const selectedProjects = projects.slice(0, 6);

  if (!selectedEmployees.length || !selectedProjects.length) {
    throw new Error("No employees or eligible projects available. Run db:seed:timesheet-demo-projects first if needed.");
  }

  let createdCount = 0;

  for (const [projectIndex, project] of selectedProjects.entries()) {
    const existing = await assignmentService.getByProjectId(project.projectId);
    const existingEmployeeIds = new Set(existing.filter((assignment) => assignment.active).map((assignment) => assignment.employeeId));
    const assignedEmployees = selectedEmployees.slice(projectIndex, projectIndex + 3);

    for (const [employeeIndex, employee] of assignedEmployees.entries()) {
      if (existingEmployeeIds.has(employee.id)) {
        continue;
      }
      const plannedHours = 80 + employeeIndex * 40 + projectIndex * 10;
      await assignmentService.create({
        projectId: project.projectId,
        employeeId: employee.id,
        roleOnProject: employeeIndex === 0 ? "Project Lead" : "Project Contributor",
        plannedHours,
        billRate: 220 + employeeIndex * 20,
        costRate: 110 + employeeIndex * 15,
        allocationPercent: 25 + employeeIndex * 15,
        startDate: project.projectStartDate,
        endDate: project.projectEndDate,
        active: true
      });
      createdCount += 1;
    }
  }

  console.log(`Created ${createdCount} project assignments.`);
} finally {
  await closeDbPool();
}
