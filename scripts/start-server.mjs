import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDir = path.join(repoRoot, "server");
const serverEnvPath = path.join(serverDir, ".env");
const port = 4000;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const safeExec = (command, args) => {
  try {
    return execFileSync(command, args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};

const getServerEnv = () => {
  if (!existsSync(serverEnvPath)) {
    return { ...process.env };
  }

  const parsed = dotenv.parse(readFileSync(serverEnvPath, "utf8"));
  return {
    ...process.env,
    ...parsed
  };
};

const run = (command, args, cwd) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit"
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited via ${signal}.`));
        return;
      }
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? 1}.`));
    });
  });

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

const resolveExistingServer = () => {
  const pid = getPortPid();
  if (!pid) {
    return { status: "none" };
  }

  const cwd = getProcessCwd(pid);
  if (path.resolve(cwd) !== serverDir) {
    return { status: "foreign", pid };
  }

  return { status: "workspace", pid };
};

await run(npmCommand, ["run", "build"], serverDir);
const existingServer = resolveExistingServer();
if (existingServer.status === "foreign") {
  console.error(`Port ${port} is in use by another process. Stop it and try again.`);
  process.exit(1);
}

if (existingServer.status === "workspace") {
  console.log(`Local server is already running for this workspace on http://localhost:${port}.`);
  console.log("Stop the existing process first if you need to reload backend code.");
  process.exit(0);
}

const childEnv = getServerEnv();

const child = spawn(process.execPath, ["dist/index.js"], {
  cwd: serverDir,
  env: childEnv,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
