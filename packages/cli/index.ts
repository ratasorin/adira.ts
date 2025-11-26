#!/usr/bin/env node
import { Command } from "commander";

import { initAction } from "./src/commands/init";
import { generateAction } from "./src/commands/generate";
import { publishAction } from "./src/commands/publish";

const program = new Command();

// Define the init command
program
  .command("init")
  .description("Initialize adira.ts configuration in the current project")
  .action(initAction);

// Define the generate command
program
  .command("generate")
  .description("Generate API type definitions from Express.js routes")
  .option("-w, --watch", "Watch for file changes and regenerate types")
  .option("-o, --output <output>", "Output directory for generated types")
  .action(generateAction);

// Define the publish command
program
  .command("publish")
  .description("Publish generated API types to local registry")
  .option("-p, --port <port>", "Verdaccio port")
  .action(publishAction);

// Add version command
program
  .version(require("../package.json").version)
  .description(
    "A powerful tool for generating API definitions from Express.js REST endpoints with MongoDB schemas",
  );

// Parse the command line arguments
program.parse(process.argv);
