import { generate } from "@n/adira.generator.ts";
import { loadConfig } from "../utils/config";

export const watchAction = async (options: { output?: string }) => {
  const config = loadConfig();
  const output = options.output || config.generatedDir;

  console.log(
    "🔄 Generating API type definitions and starting watch mode...",
  );

  try {
    const result = await generate({ generatedDir: output });
    console.log(`✅ Found ${result.routeMap.length} routes`);
    console.log("✅ Wrote type definitions");

    console.log("👀 Starting watch mode...");

    const chokidar = await import("chokidar");

    const watcher = chokidar.watch("src/**/*.ts", {
      ignored: new RegExp(`src\\/generated\\/|${output}\\/`),
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
        await generate({ generatedDir: output });
        console.log("✅ Regenerated types");
      } catch (error) {
        console.error("❌ Error regenerating types:", error);
      }
    });
  } catch (error) {
    console.error("❌ Error during type generation:", error);
    process.exit(1);
  }
};
