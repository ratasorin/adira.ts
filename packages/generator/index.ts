import chokidar from "chokidar";
import { ChildProcess } from "child_process";
import { loadConfig, AdiraConfig } from "./config";
import { verdaccioManager } from "./verdaccio";
import fs from "fs";
import path from "path";

const runCommand = (cmd: string, cwd: string = process.cwd()) =>
  new Promise<void>((resolve, reject) => {
    const { spawn } = require("child_process");
    const proc = spawn(cmd, { shell: true, stdio: "inherit", cwd });
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed: ${cmd}`));
    });
    proc.on("error", (err) => {
      reject(new Error(`Failed to execute command ${cmd}: ${err.message}`));
    });
  });

let ready = false;
let verdaccioStarted = false;
let verdaccioProcess: ChildProcess | null = null;

async function replaceMongooseObjectId(generatedDir: string) {
  console.log("🔄 Post-processing types for ObjectId replacement...");

  function processFile(filePath: string) {
    let content = fs.readFileSync(filePath, "utf-8");

    // Remove mongoose import lines
    content = content.replace(
      /^import\s+mongoose.*from\s+['"]mongoose['"].*\n/gm,
      ""
    );

    // Replace mongoose.Types.ObjectId with ObjectIdLike
    content = content.replace(/mongoose\.Types\.ObjectId/g, "ObjectIdLike");

    // Inject ObjectIdLike type if missing
    if (!content.includes("type ObjectIdLike =")) {
      content =
        `export type ObjectIdLike = string & { __objectIdBrand?: never };\n\n` +
        content;
    }

    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`✅ Processed ${path.relative(process.cwd(), filePath)}`);
  }

  function walkDir(dir: string) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((dirent) => {
      const fullPath = path.join(dir, dirent.name);
      if (dirent.isDirectory()) {
        walkDir(fullPath);
      } else if (fullPath.endsWith(".d.ts")) {
        processFile(fullPath);
      }
    });
  }

  if (fs.existsSync(generatedDir)) {
    walkDir(generatedDir);
  }
}

const run = async (config: AdiraConfig) => {
  if (!verdaccioStarted) {
    console.log("⚠️ Verdaccio not ready. Skipping publishing step.");
    return;
  }

  console.log("⚙️  Publishing types...");
  try {
    await runCommand("npm run types:remove");
  } catch (err) {
    console.error("❌ Packages missing, skipping remove...");
  }
  await runCommand("npm run types:build");

  const generatedDir = path.resolve(
    process.cwd(),
    config.generatedDir || "types"
  );
  await replaceMongooseObjectId(generatedDir);

  await runCommand("npm run types:publish");

  console.log("✅ Types published.");
};

const startVerdaccio = async (config: AdiraConfig): Promise<void> => {
  const port = config.verdaccioPort || 8888;

  if (verdaccioProcess) {
    console.log("🟢 Verdaccio already running (managed by this process).");
    return;
  }

  // Start Verdaccio or detect existing instance
  const process = await verdaccioManager.start(config);
  verdaccioProcess = process;
  verdaccioStarted = !!process;
};

const cleanup = () => {
  if (verdaccioProcess) {
    console.log("🛑 Killing Verdaccio...");
    verdaccioManager.stop(verdaccioProcess);
    verdaccioProcess = null;
  }
  console.log("👋 Shutting down watcher.");
  process.exit(0);
};

// Use SIGINT (Ctrl+C) and SIGTERM (standard kill signal) for graceful shutdown
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

const watch = (config: AdiraConfig) => {
  const path = require("path");
  const watchPath = config.inputSrc || "src/**/*.ts";
  const resolvedWatchPath = path.resolve(process.cwd(), watchPath);

  const watcher = chokidar.watch(resolvedWatchPath, {
    ignored: /src\/generated\//,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  watcher.on("ready", () => {
    ready = true;
    console.log("👀 Watcher is ready. Listening for changes...");
  });

  watcher.on("all", async (event, path) => {
    if (!ready) return;
    console.log(`[${event}] ${path}`);
    await run(config);
  });
};

(async () => {
  const config = loadConfig();

  // Start Verdaccio or detect existing instance
  await startVerdaccio(config);

  // Initial run to generate and publish types
  await run(config);

  // Start watching files, which keeps the process alive indefinitely
  watch(config);
})();
