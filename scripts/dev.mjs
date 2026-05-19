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
    bootstrapOnly: true,
  },
  {
    name: "frontend",
    cwd: path.join(rootDir, "nexOOS"),
    args: ["run", "dev"],
    bootstrapOnly: false,
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

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

async function isBackendReady() {
  try {
    const response = await fetch("http://127.0.0.1:3001/api/health");
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForBackendReady({
  timeoutMs = 90000,
  intervalMs = 1000,
} = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isBackendReady()) {
      return true;
    }

    await sleep(intervalMs);
  }

  return false;
}

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

async function main() {
  const backendService = services.find((service) => service.name === "backend");
  const frontendService = services.find((service) => service.name === "frontend");

  if (!backendService || !frontendService) {
    console.error("[dev] Missing backend or frontend service configuration.");
    process.exit(1);
  }

  startService(backendService);
  console.log("[dev] Waiting for backend health at http://127.0.0.1:3001/api/health ...");

  const backendReady = await waitForBackendReady();
  if (!backendReady) {
    console.warn(
      "[dev] Backend did not become healthy within 90s. Starting frontend anyway.",
    );
  } else {
    console.log("[dev] Backend is healthy. Starting frontend.");
  }

  startService(frontendService);
}

function startService(service) {
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

    if (service.bootstrapOnly && (code === 0 || signal === "SIGINT")) {
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

main().catch((error) => {
  console.error("[dev] Failed to start development environment:", error);
  shutdown(1);
});
