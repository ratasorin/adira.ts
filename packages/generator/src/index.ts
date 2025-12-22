import { AdiraConfig } from "@n/adira.core.ts";
import { loadConfig } from "./config";
import { writeTypes } from "./writer";
import { discoverRouterDefinitions } from "src/handler/discover";
import {
  compileProject,
  findProjectConfig,
  getProjectFiles,
  getParsedCommandLine,
  DependencyResolver,
} from "src/utils";
import { generateApiDefinitonForHandlers } from "src/handler/generate";
import ts from "typescript";
import { ImportCollector } from "src/imports/collector";
import path from "path";

export interface GeneratorResult {
  routeMap: any[];
  apiTypes: any;
}

export const generateApiDefinitions = async (config: AdiraConfig) => {
  const outputDir = config.output.dir || "./shared";

  // find source tsconfig:
  const tsconfigPath = findProjectConfig();
  const tsconfig = getParsedCommandLine(tsconfigPath);
  const files = getProjectFiles(tsconfig);

  const handlers = await discoverRouterDefinitions(files, tsconfig.options);

  // compile the project into the output directory
  const sharedDir = await compileProject(
    tsconfig.fileNames,
    tsconfig.options,
    outputDir,
  );

  const declarationFiles = tsconfig.fileNames.map((f) => {
    const relative = path.relative(
      tsconfig.options.rootDir || process.cwd(),
      f,
    );
    return path.join(sharedDir, relative).replace(/\.ts$/, ".d.ts");
  });

  // 4. Phase B: Extraction (New Program pointing ONLY to declarations)
  const program = ts.createProgram({
    rootNames: declarationFiles,
    options: {
      ...tsconfig.options,
      skipLibCheck: true,
      allowJs: false,
      declaration: true,
      rootDir: sharedDir, // Base logic now centers on the shared folder
    },
  });

  const dependencyResolver = new DependencyResolver(
    program,
    config.allowedDependencies,
  );

  const importCollector = new ImportCollector(
    program,
    dependencyResolver,
    sharedDir,
  );

  const apiDefiniton = await generateApiDefinitonForHandlers(
    handlers,
    program,
    importCollector,
  );

  writeTypes(
    apiDefiniton,
    importCollector.getImportLines(),
    config.output.typename || "ApiTypes",
    config.output.dir,
  );
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
