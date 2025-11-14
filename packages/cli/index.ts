#!/usr/bin/env node
import { Command } from "commander";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import fs from "fs";
import net from "net";
import { parseRoutes } from "../../dist/src/parser";
import { generateTypes } from "../../dist/src/typegen";
import { writeTypes } from "../../dist/src/writer";

const program = new Command();

// Function to run shell commands
const runCommand = (cmd: string, cwd: string = process.cwd()) =>
  new Promise<void>((resolve, reject) => {
    const proc = spawn(cmd, { shell: true, stdio: "inherit", cwd });
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed: ${cmd}`));
    });
    proc.on("error", (err) => {
      reject(new Error(`Failed to execute command ${cmd}: ${err.message}`));
    });
  });

// Function to check if port is in use
const isPortInUse = async (port: number): Promise<boolean> => {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();

    server.once("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        resolve(true);
      } else {
        console.error(`Error checking port ${port}:`, err.message);
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close(() => resolve(false)); // Port is free
    });

    server.listen(port);
  });
};

// Function to start Verdaccio
const startVerdaccio =
  async (): Promise<ChildProcessWithoutNullStreams | null> => {
    const PORT = 8888;

    // Check if port is already in use
    const portInUse = await isPortInUse(PORT);
    if (portInUse) {
      console.log(
        `✅ Port ${PORT} is already in use. Assuming Verdaccio is running externally.`
      );
      return null;
    }

    console.log(`🚀 Starting Verdaccio on port ${PORT}...`);

    const verdaccioProcess = spawn(
      "npx",
      ["verdaccio", "--listen", String(PORT)],
      {
        stdio: "inherit",
        shell: true,
      }
    );

    // Wait for Verdaccio to start
    await new Promise((resolve) => setTimeout(resolve, 5000));

    return verdaccioProcess;
  };

// Function to stop Verdaccio process
const stopVerdaccio = (process: ChildProcessWithoutNullStreams | null) => {
  if (process) {
    console.log("🛑 Stopping Verdaccio...");
    process.kill("SIGTERM");
  }
};

// Define the init command
program
  .command("init")
  .description("Initialize adira.ts configuration in the current project")
  .action(async () => {
    console.log("🚀 Initializing adira.ts configuration...");

    // Create adira.ts config file
    const configContent = `{
  "input": "./src",
  "output": "./types",
  "watch": true,
  "publish": true,
  "verdaccioPort": 8888
}
`;

    const configPath = path.join(process.cwd(), "adira.config.json");
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, configContent);
      console.log("✅ Created adira.config.json");
    } else {
      console.log("⚠️  adira.config.json already exists, skipping creation");
    }

    // Update package.json with adira.ts scripts if they don't exist
    const packageJsonPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }

      let updated = false;

      if (!packageJson.scripts["adira:generate"]) {
        packageJson.scripts["adira:generate"] = "adira.ts generate";
        updated = true;
      }

      if (!packageJson.scripts["adira:publish"]) {
        packageJson.scripts["adira:publish"] = "adira.ts publish";
        updated = true;
      }

      if (updated) {
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log("✅ Updated package.json with adira.ts scripts");
      }
    }

    console.log("✅ adira.ts initialization complete!");
    console.log("\nNext steps:");
    console.log("1. Review the generated adira.config.json file");
    console.log("2. Run `npx @n/adira.ts generate` to generate API types");
    console.log(
      "3. Run `npx @n/adira.ts publish` to publish types to your local registry"
    );
  });

// Define the generate command
program
  .command("generate")
  .description("Generate API type definitions from Express.js routes")
  .option("-w, --watch", "Watch for file changes and regenerate types")
  .option(
    "-o, --output <output>",
    "Output directory for generated types",
    "./types"
  )
  .action(async (options) => {
    console.log("🔄 Generating API type definitions...");

    try {
      // Parse routes
      const routeMap = await parseRoutes();
      console.log(`✅ Found ${routeMap.length} routes`);

      // Generate types
      const apiTypes = await generateTypes(routeMap);
      console.log("✅ Generated type definitions");

      // Write types to specified output directory
      const outputDir = path.resolve(process.cwd(), options.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Update the writer to use the specified output directory
      // For now, we'll write to a temp location and then move
      writeTypes(apiTypes);
      console.log("✅ Wrote type definitions");

      // Run post-processing step for ObjectId replacement
      console.log("🔄 Post-processing types for ObjectId replacement...");

      const generatedDir = path.resolve(
        __dirname,
        "..",
        "dist",
        "src",
        "generated"
      );

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

      console.log("✅ Type generation complete!");

      // If watch mode is enabled, start watching
      if (options.watch) {
        console.log("👀 Starting watch mode...");

        // Dynamically import chokidar to avoid issues when not needed
        const chokidar = await import("chokidar");

        const watcher = chokidar.watch("src/**/*.ts", {
          ignored: /src\/generated\//,
          ignoreInitial: false,
          awaitWriteFinish: {
            stabilityThreshold: 100,
            pollInterval: 50,
          },
        });

        watcher.on("ready", () => {
          console.log("👀 Watcher is ready. Listening for changes...");
        });

        watcher.on("all", async (event, filePath) => {
          console.log(`[${event}] ${filePath}`);
          try {
            const routeMap = await parseRoutes();
            const apiTypes = await generateTypes(routeMap);
            writeTypes(apiTypes);

            // Run post-processing step
            if (fs.existsSync(generatedDir)) {
              walkDir(generatedDir);
            }

            console.log("✅ Regenerated types");
          } catch (error) {
            console.error("❌ Error regenerating types:", error);
          }
        });
      }
    } catch (error) {
      console.error("❌ Error during type generation:", error);
      process.exit(1);
    }
  });

// Define the publish command
program
  .command("publish")
  .description("Publish generated API types to local registry")
  .option("-p, --port <port>", "Verdaccio port", "8888")
  .action(async (options) => {
    console.log("📦 Publishing API types...");

    try {
      // Start Verdaccio if needed
      const verdaccioProcess = await startVerdaccio();

      // First, try to remove existing package (if it exists)
      console.log("🧹 Removing existing package...");
      try {
        await runCommand(
          'npm run types:remove || echo "No existing package to remove"'
        );
      } catch (err) {
        console.log("⚠️  Could not remove existing package, continuing...");
      }

      // Build the types package
      console.log("🔨 Building types package...");
      await runCommand("npm run types:build");

      // Publish the types
      console.log("📤 Publishing types...");
      await runCommand("npm run types:publish");

      console.log("✅ Types published successfully!");

      // Clean up Verdaccio process if we started it
      stopVerdaccio(verdaccioProcess);
    } catch (error) {
      console.error("❌ Error during publishing:", error);
      process.exit(1);
    }
  });

// Define the watch command separately to avoid recursion
program
  .command("watch")
  .description("Watch for changes and regenerate API types")
  .option(
    "-o, --output <output>",
    "Output directory for generated types",
    "./types"
  )
  .action(async (options) => {
    console.log(
      "🔄 Generating API type definitions and starting watch mode..."
    );

    try {
      // Parse routes
      const routeMap = await parseRoutes();
      console.log(`✅ Found ${routeMap.length} routes`);

      // Generate types
      const apiTypes = await generateTypes(routeMap);
      console.log("✅ Generated type definitions");

      // Write types to specified output directory
      const outputDir = path.resolve(process.cwd(), options.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      writeTypes(apiTypes);
      console.log("✅ Wrote type definitions");

      // Run post-processing step for ObjectId replacement
      console.log("🔄 Post-processing types for ObjectId replacement...");

      const generatedDir = path.resolve(
        __dirname,
        "..",
        "dist",
        "src",
        "generated"
      );

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

      console.log("👀 Starting watch mode...");

      // Dynamically import chokidar to avoid issues when not needed
      const chokidar = await import("chokidar");

      const watcher = chokidar.watch("src/**/*.ts", {
        ignored: /src\/generated\//,
        ignoreInitial: false,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      watcher.on("ready", () => {
        console.log("👀 Watcher is ready. Listening for changes...");
      });

      watcher.on("all", async (event, filePath) => {
        console.log(`[${event}] ${filePath}`);
        try {
          const routeMap = await parseRoutes();
          const apiTypes = await generateTypes(routeMap);
          writeTypes(apiTypes);

          // Run post-processing step
          if (fs.existsSync(generatedDir)) {
            walkDir(generatedDir);
          }

          console.log("✅ Regenerated types");
        } catch (error) {
          console.error("❌ Error regenerating types:", error);
        }
      });
    } catch (error) {
      console.error("❌ Error during type generation:", error);
      process.exit(1);
    }
  });

// Add version command
program
  .version(require("../package.json").version)
  .description(
    "A powerful tool for generating API definitions from Express.js REST endpoints with MongoDB schemas"
  );

// Parse the command line arguments
program.parse(process.argv);
