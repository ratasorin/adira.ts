#!/usr/bin/env node
import { buildTypes } from "../utils/publish-remove";

// Build types package
async function main() {
  const packagePath = process.argv[2] || "./packages/types";

  try {
    await buildTypes(packagePath);
  } catch (error) {
    console.error("Failed to build types:", error);
    process.exit(1);
  }
}

main();
