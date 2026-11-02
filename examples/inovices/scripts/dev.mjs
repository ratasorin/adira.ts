import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const children = [
  spawn(process.execPath, [require.resolve("tsx/cli"), "watch", "src/index.ts"], { cwd: resolve(root, "backend"), stdio: "inherit" }),
  spawn(process.execPath, [resolve(dirname(require.resolve("vite/package.json")), "bin/vite.js")], { cwd: resolve(root, "frontend"), stdio: "inherit" }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
for (const child of children) {
  child.on("error", error => { console.error(error); stop(1); });
  child.on("exit", code => stop(code || 0));
}
