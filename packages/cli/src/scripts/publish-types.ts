#!/usr/bin/env node
import { publishTypes } from "../utils/publish-remove";

// Publish types package to Verdaccio
async function main() {
  const packagePath = process.argv[2] || "./packages/types";
  const registryUrl = process.argv[3] || "http://localhost:8888";

  try {
    await publishTypes(packagePath, registryUrl);
  } catch (error) {
    console.error("Failed to publish types:", error);
    process.exit(1);
  }
}

main();
