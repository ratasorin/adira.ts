import { parseRoutes } from "./parser"; 
import { generateTypes } from "./typegen";
import { writeTypes } from "./writer";
import chokidar from "chokidar";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import fs from "fs";
import path from "path";
import net from "net"; 

const GENERATED_DIR = path.resolve(__dirname, "..", "types"); // adjust as needed
const VERDACCIO_TIMEOUT_MS = 5000; // Increased timeout for stability

const runCommand = (cmd: string) =>
  new Promise<void>((resolve, reject) => {
    const proc = spawn(cmd, { shell: true, stdio: "inherit" });
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
let verdaccioProcess: ChildProcessWithoutNullStreams | null = null;

async function replaceMongooseObjectId() {
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

  walkDir(GENERATED_DIR);
}

const run = async () => {
  // 1. Generate types first (always run)
  const routeMap = await parseRoutes();
  const apiTypes = await generateTypes(routeMap);
  writeTypes(apiTypes);
  
  // 2. Publish types (only if Verdaccio is stable)
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

  // Run the post-processing step after types are generated
  await replaceMongooseObjectId();

  await runCommand("npm run types:publish");

  console.log("✅ Types published.");
};

const startVerdaccio = async (): Promise<void> => {
  const PORT = 8888;
  
  if (verdaccioProcess) {
    console.log("🟢 Verdaccio already running (managed by this process).");
    return;
  }
  
  // 1. Check if port is already in use using native net module
  const isPortInUse = await new Promise<boolean>((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err: any) => {
        // EADDRINUSE indicates the port is taken
        if (err.code === 'EADDRINUSE') {
            resolve(true); 
        } else {
            console.error(`Error checking port ${PORT}:`, err.message);
            resolve(false);
        }
    });
    
    server.once('listening', () => {
        server.close(() => resolve(false)); // Port is free
    });
    
    server.listen(PORT);
  });
  
  // 2. Decide based on port status
  if (isPortInUse) {
      console.log(`✅ Port ${PORT} is already in use. Assuming Verdaccio is running externally and using it.`);
      verdaccioStarted = true;
      return;
  }
  
  // 3. Port is free, start the process
  console.log("🚀 Starting Verdaccio...");
  verdaccioStarted = false; 

  verdaccioProcess = spawn("npx", ["verdaccio", "--listen", String(PORT)], {
    stdio: "inherit",
    shell: true,
  });

  // Attach a listener to monitor if the process dies
  verdaccioProcess.on("exit", (code, signal) => {
    console.error(`🔴 Verdaccio exited unexpectedly with code ${code} and signal ${signal}`);
    verdaccioStarted = false;
    verdaccioProcess = null;
  });
  
  verdaccioProcess.on("error", (err) => {
    console.error("Failed to start Verdaccio:", err);
    verdaccioStarted = false;
    verdaccioProcess = null;
  });

  // 4. Wait for stability
  await new Promise((resolve) => setTimeout(resolve, VERDACCIO_TIMEOUT_MS));
  
  if (!verdaccioProcess) {
      console.error("❌ Verdaccio failed to initialize within the timeout. Please check console output for errors.");
  } else {
      verdaccioStarted = true;
      console.log("🟢 Verdaccio is running.");
  }
};

const cleanup = () => {
  if (verdaccioProcess) {
    console.log("🛑 Killing Verdaccio...");
    verdaccioProcess.kill("SIGTERM");
    verdaccioProcess = null;
  }
  console.log("👋 Shutting down watcher.");
  process.exit(0);
};

// Use SIGINT (Ctrl+C) and SIGTERM (standard kill signal) for graceful shutdown
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

const watch = () => {
  const watcher = chokidar.watch("src/**/*.ts", {
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
    await run();
  });
};

(async () => {
  // Start Verdaccio or detect existing instance
  await startVerdaccio();
  
  // Initial run to generate and publish types
  await run();
  
  // Start watching files, which keeps the process alive indefinitely
  watch();
})();