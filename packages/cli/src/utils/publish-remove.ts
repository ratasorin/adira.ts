import { runCommand } from "../utils";

/**
 * Remove a published package from Verdaccio registry
 * @param packageName - Name of the package to remove from the user's package.json
 * @param registryUrl - Verdaccio registry URL
 */
export const removeTypes = async (
  packageName: string,
  registryUrl: string,
): Promise<void> => {
  console.log(`🧹 Removing package ${packageName} from ${registryUrl}...`);

  try {
    // Set npm registry to Verdaccio and unpublish the package
    await runCommand(
      `npm unpublish ${packageName} --registry=${registryUrl} --force`,
    );
    console.log(`✅ Package ${packageName} removed successfully`);
  } catch (error) {
    console.log(`⚠️  Could not remove package ${packageName}, continuing...`);
    // Don't throw error - this is expected if package doesn't exist
  }
};

/**
 * Publish the built types package to Verdaccio registry
 * @param packagePath - Path to the package directory
 * @param registryUrl - Verdaccio registry URL
 */
export const publishTypes = async (
  packagePath: string = "./shared",
  registryUrl: string = "http://localhost:8888",
): Promise<void> => {
  console.log(`📤 Publishing types to ${registryUrl}...`);

  try {
    // Set npm registry to Verdaccio and publish
    await runCommand(
      `cd ${packagePath} && npm publish --registry=${registryUrl}`,
    );

    console.log(`✅ Types published successfully to Verdaccio`);
  } catch (error) {
    throw new Error(`Failed to publish types package: ${error}`);
  }
};
