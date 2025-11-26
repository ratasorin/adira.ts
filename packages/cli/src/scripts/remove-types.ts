#!/usr/bin/env node
import { removeTypes } from "../utils/publish-remove";

// Remove types package from Verdaccio
async function main() {
  const packageName = process.argv[2] || "@n/adira.types";
  const registryUrl = process.argv[3] || "http://localhost:8888";

  try {
    await removeTypes(packageName, registryUrl);
  } catch (error) {
    console.error("Failed to remove types:", error);
    process.exit(1);
  }
}

main();
