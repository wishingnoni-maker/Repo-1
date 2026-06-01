import { closeDbPool } from "../src/db/pool.js";
import { createProjectRepository } from "../src/repositories/index.js";
import { loadScriptEnv } from "./databaseUtils.js";

loadScriptEnv();

const activeStatuses = new Set(["active", "in progress", "open", "current", "ongoing", "started"]);

try {
  const repository = createProjectRepository();
  const projects = await repository.getAll();
  const ranked = [...projects]
    .sort((a, b) => {
      const aDate = new Date(a.projectEndDate ?? a.projectStartDate ?? 0).getTime();
      const bDate = new Date(b.projectEndDate ?? b.projectStartDate ?? 0).getTime();
      return bDate - aDate;
    })
    .slice(0, 10);

  const endDate = new Date();
  endDate.setUTCDate(endDate.getUTCDate() + 90);
  const endDateLabel = endDate.toISOString().slice(0, 10);
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - 30);
  const startDateLabel = startDate.toISOString().slice(0, 10);

  for (const project of ranked) {
    await repository.update(project.id, {
      projectStatus: activeStatuses.has(project.projectStatus.toLowerCase()) ? project.projectStatus : "Active",
      projectStartDate: project.projectStartDate ?? startDateLabel,
      projectEndDate: endDateLabel,
      plannedLoeHours: project.plannedLoeHours ?? project.budgetHours ?? project.projectEstimatedHrs ?? 400,
      soldAmount: project.soldAmount ?? project.budgetCost ?? 120000,
      blendedBillRate: project.blendedBillRate ?? 250,
      blendedCostRate: project.blendedCostRate ?? 125
    });
  }

  console.log("Updated demo timesheet projects:");
  ranked.forEach((project) => {
    console.log(`- ${project.projectName}`);
  });
} finally {
  await closeDbPool();
}
