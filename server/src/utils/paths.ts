import { existsSync } from "node:fs";
import path from "node:path";

export const resolveServerDataPath = (fileName: string) => {
  const directDataPath = path.resolve(process.cwd(), "data", fileName);
  const nestedServerDataPath = path.resolve(process.cwd(), "server", "data", fileName);

  if (path.basename(process.cwd()) === "server") {
    if (existsSync(directDataPath)) {
      return directDataPath;
    }
    if (existsSync(nestedServerDataPath)) {
      return nestedServerDataPath;
    }
    return directDataPath;
  }

  if (existsSync(nestedServerDataPath)) {
    return nestedServerDataPath;
  }

  if (existsSync(directDataPath)) {
    return directDataPath;
  }

  return nestedServerDataPath;
};
