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
  let parsed: Record<string, T[]>;
  try {
    parsed = JSON.parse(raw) as Record<string, T[]>;
  } catch {
    throw new Error(
      `The local JSON store at ${filePath} is invalid. Restore or reset the file before continuing.`
    );
  }
  return parsed[key] ?? [];
};

export const writeJsonCollection = async <T>(
  filePath: string,
  key: string,
  items: T[]
): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify({ [key]: items }, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
};
