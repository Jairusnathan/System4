import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const services = [
  {
    name: "backend",
    cwd: path.join(rootDir, "greenovate-be"),
    args: ["run", "start:dev"],
  },
  {
    name: "frontend",
    cwd: path.join(rootDir, "nexOOS"),
    args: ["run", "dev"],
  },
];

for (const service of services) {
  if (!existsSync(service.cwd)) {
    console.error(`[dev] Missing folder: ${service.cwd}`);
    process.exit(1);
  }
}

let shuttingDown = false;
const children = [];

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    }

    process.exit(exitCode);
  }, 1500).unref();
}

for (const service of services) {
  const child = spawn(npmCommand, service.args, {
    cwd: service.cwd,
    env: process.env,
    stdio: "inherit",
    shell: true,
  });

  children.push(child);

  child.on("error", (error) => {
    console.error(`[${service.name}] failed to start`, error);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (code === 0 || signal === "SIGINT") {
      shutdown(0);
      return;
    }

    console.error(
      `[${service.name}] exited unexpectedly with ${signal ?? `code ${code}`}`,
    );
    shutdown(code ?? 1);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
