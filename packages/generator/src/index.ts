import { AdiraConfig } from "@n/adira.core.ts";
import { loadConfig } from "./config";
import { writeAPI } from "./writer";
import { discoverRouterDefinitions } from "./handler/discover";
import {
  compileProject,
  findProjectConfig,
  createProject,
  getParsedCommandLine,
  DependencyResolver,
} from "./utils";
import { generateApiDefinitonForHandlers } from "./handler/generate";
import ts from "typescript";
import path from "path";
import { SymbolCollector } from "./imports/collector";
import { getSymbolsName } from "./utils/tests";
import { SymbolPruner } from "./pruner";

export interface GeneratorResult {
  routeMap: any[];
  apiTypes: any;
}

export const generateApiDefinitions = async (config: AdiraConfig) => {
  const outputDir = config.output.dir || "./shared";

  // find source tsconfig:
  const tsconfigPath = findProjectConfig();
  const tsconfig = getParsedCommandLine(tsconfigPath);

  const { files: initialFiles, program: initialProgram } =
    createProject(tsconfig);

  const handlers = await discoverRouterDefinitions(
    initialFiles,
    tsconfig.options,
    initialProgram.getTypeChecker(),
  );

  // compile the project into the output directory
  const compiledProject = await compileProject(
    tsconfig.fileNames,
    tsconfig.options,
    outputDir,
  );

  const files = compiledProject.getSourceFiles();
  const projectFiles = files.filter(
    (f) =>
      !compiledProject.isSourceFileDefaultLibrary(f) &&
      !compiledProject.isSourceFileFromExternalLibrary(f),
  );

  const dependencyResolver = new DependencyResolver(compiledProject, [
    ...config.allowedDependencies,
    "@n/adira.core.ts",
  ]);

  const symbolCollector = new SymbolCollector(
    compiledProject,
    dependencyResolver,
  );

  const srcRoot = path.dirname(initialProgram.getRootFileNames()[0]);
  const dtsRoot = path.dirname(compiledProject.getRootFileNames()[0]);

  handlers.forEach(({ handler }) => {
    const relativeToSrc = path.relative(srcRoot, handler.sourcePath);

    handler.sourcePath = path.join(
      dtsRoot,
      relativeToSrc.replace(/\.ts$/, ".d.ts"),
    );
  });

  const apiDefiniton = await generateApiDefinitonForHandlers(
    handlers,
    compiledProject,
    symbolCollector,
  );

  const pruner = new SymbolPruner(
    compiledProject.getTypeChecker(),
    symbolCollector.collectedSymbols(),
  );

  projectFiles.forEach((file) => {
    pruner.save(file);
  });

  writeAPI({
    api: apiDefiniton,
    collector: symbolCollector,
    config: {
      // Todo: Add a description parameter to AdiraConfig
      description: "<API Description>",
      outputDir: config.output.dir,
      outputFile: config.output.file || "api.d.ts",
      whitelistedPackages: config.allowedDependencies,
      packageName: config.registry.name,
      version: config.registry.version,
    },
    dependencyResolver,
    program: compiledProject,
  });
};

export const generate = async (config?: Partial<AdiraConfig>) => {
  const fullConfig = { ...loadConfig(), ...config };

  console.log("🚀 Starting API generation...");

  await generateApiDefinitions(fullConfig);

  console.log("✅ Generation complete.");
};

// For direct execution
if (require.main === module) {
  generate().catch(console.error);
}
