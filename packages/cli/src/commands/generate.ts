import { generate } from "@n/adira.generator.ts";
import { loadConfig } from "../utils/config";

export const generateAction = async (options: {
  watch?: boolean;
  output?: string;
}) => {
  const config = loadConfig();
  const output = options.output || config.output.dir;

  console.log("🔄 Generating API type definitions...");

  try {
    const result = await generate(config);
    console.log(`✅ Found ${result.routeMap.length} routes`);
    console.log("✅ Type generation complete!");

    // If watch mode is enabled, start watching
    if (options.watch) {
      console.log("👀 Starting watch mode...");

      const chokidar = await import("chokidar");
      const watcher = chokidar.watch("src/**/*.ts", {
        ignored: new RegExp(`${output}\\/`),
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
          await generate(config);
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
};
