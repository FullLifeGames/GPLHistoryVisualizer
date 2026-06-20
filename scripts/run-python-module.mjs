import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleName = process.argv[2];
const moduleArgs = process.argv.slice(3);

if (!moduleName) {
  console.error("Usage: node scripts/run-python-module.mjs <module> [...args]");
  process.exit(2);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempDir = path.join(repoRoot, ".tmp", "python", `${Date.now()}-${process.pid}`);
mkdirSync(tempDir, { recursive: true });

const pythonPath = [path.join(repoRoot, "src"), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter);
const child = spawn("python", ["-m", moduleName, ...moduleArgs], {
  cwd: repoRoot,
  env: {
    ...process.env,
    PYTHONPATH: pythonPath,
    TMP: tempDir,
    TEMP: tempDir,
  },
  shell: false,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`python exited from signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
