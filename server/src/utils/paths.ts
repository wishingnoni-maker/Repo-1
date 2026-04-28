import path from "node:path";

export const resolveServerDataPath = (fileName: string) =>
  path.basename(process.cwd()) === "server"
    ? path.resolve(process.cwd(), "data", fileName)
    : path.resolve(process.cwd(), "server", "data", fileName);
