import { promises as fs } from "node:fs";
import path from "node:path";

export const readJsonCollection = async <T>(
  filePath: string,
  key: string
): Promise<T[]> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify({ [key]: [] }, null, 2), "utf8");
  }

  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, T[]>;
  return parsed[key] ?? [];
};

export const writeJsonCollection = async <T>(
  filePath: string,
  key: string,
  items: T[]
): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify({ [key]: items }, null, 2), "utf8");
};
