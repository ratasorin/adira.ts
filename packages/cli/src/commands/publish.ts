import { runCommand, startVerdaccio, stopVerdaccio } from "../utils";
import { loadConfig } from "../utils/config";

export const publishAction = async (options: { port?: string }) => {
  const config = loadConfig();
  const port = options.port || config.verdaccioPort.toString();

  console.log("📦 Publishing API types...");

  try {
    // Start Verdaccio if needed
    const verdaccioProcess = await startVerdaccio(parseInt(port, 10));

    // First, try to remove existing package (if it exists)
    console.log("🧹 Removing existing package...");
    try {
      await runCommand(
        'npm run types:remove || echo "No existing package to remove"',
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
};
