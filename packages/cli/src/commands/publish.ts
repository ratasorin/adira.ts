import { startVerdaccio, stopVerdaccio } from "../utils";
import { loadConfig } from "../utils/config";
import { removeTypes, publishTypes } from "../utils/publish-remove";

export const publishAction = async (options: { port?: string }) => {
  const config = loadConfig();
  const port = options.port || config.registry.port.toString();

  console.log("📦 Publishing API types...");

  try {
    // Start Verdaccio if needed
    const verdaccioProcess = await startVerdaccio(parseInt(port, 10));

    // First, try to remove existing package (if it exists)
    console.log("🧹 Removing existing package...");
    try {
      await removeTypes(config.registry.name, `${config.registry.url}:${port}`);
    } catch (err) {
      console.log("⚠️  Could not remove existing package, continuing...");
    }

    // Publish the types
    console.log("📤 Publishing types...");
    await publishTypes("./packages/types", `${config.registry.url}:${port}`);

    console.log("✅ Types published successfully!");

    // Clean up Verdaccio process if we started it
    stopVerdaccio(verdaccioProcess);
  } catch (error) {
    console.error("❌ Error during publishing:", error);
    process.exit(1);
  }
};
