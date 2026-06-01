import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(repoRoot, "client");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const port = 5173;

const safeExec = (command, args) => {
  try {
    return execFileSync(command, args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};

const getPortPid = () => {
  const output = safeExec("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  if (!output) {
    return null;
  }

  const pid = Number(output.split(/\s+/)[0]);
  return Number.isFinite(pid) ? pid : null;
};

const getProcessCwd = (pid) => {
  const output = safeExec("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]);
  const match = output.match(/\nn(.+)$/m) ?? output.match(/^n(.+)$/m);
  return match?.[1]?.trim() ?? "";
};

const resolveExistingVite = () => {
  const pid = getPortPid();
  if (!pid) {
    return { status: "none" };
  }

  const cwd = getProcessCwd(pid);
  if (path.resolve(cwd) !== clientDir) {
    return { status: "foreign", pid };
  }

  return { status: "workspace", pid };
};

const existingVite = resolveExistingVite();
if (existingVite.status === "foreign") {
  console.error(`Port ${port} is in use by another process. Stop it and try again.`);
  process.exit(1);
}

if (existingVite.status === "workspace") {
  console.log(`Local client is already running for this workspace on http://localhost:${port}.`);
  console.log("Reuse the open browser tab, or stop the existing Vite process before restarting it.");
  process.exit(0);
}

const child = spawn(npmCommand, ["run", "dev:raw"], {
  cwd: clientDir,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
