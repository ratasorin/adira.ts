import fs from "fs";
import path from "path";
import { ApiDefinition } from "src/handler/generate";

/**
 * Generates a package.json for the output artifact.
 * Scans the root package.json to resolve versions for whitelisted dependencies.
 */
export function generatePackageJson(props: {
  outputDir: string;
  whitelistedPackages: string[];
  packageName: string;
  version: string; // The version of the generated package
  description: string;
  workingDir: string;
}) {
  // 1. Read Root package.json
  const rootPkgPath = path.resolve(props.outputDir, "package.json");
  let rootPkg: any = {};

  if (fs.existsSync(rootPkgPath)) {
    try {
      rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
    } catch (e) {
      console.warn("⚠️  Could not parse root package.json");
    }
  } else {
    console.warn(`⚠️  No root package.json found at ${props.workingDir}`);
  }

  // 2. Resolve Versions (Check deps, devDeps, and peerDeps)
  const allDeps = {
    ...rootPkg.dependencies,
    ...rootPkg.devDependencies,
    ...rootPkg.peerDependencies,
  };

  console.log({ w: props.whitelistedPackages });
  const resolvedDeps: Record<string, string> = {};

  props.whitelistedPackages.forEach((pkg) => {
    const version = allDeps[pkg];
    if (version) {
      resolvedDeps[pkg] = version;
    } else {
      console.warn(
        `⚠️  Warning: Package '${pkg}' is whitelisted but not found in root package.json`,
      );
      // Optional: Default to "*" or fail? For now, we omit it.
    }
  });

  // 3. Construct the Output Object
  const outPkg = {
    name: props.packageName,
    version: props.version,
    description: props.description,
    main: "index.api.ts", // or .js if you compile it
    types: "index.api.ts",
    // 4. Strategy: Peers + Devs
    // - Peers: Tells the consumer "You must provide this package" (e.g. React)
    // - Devs: Allows this folder to be compiled/linted in isolation if needed
    peerDependencies: sortObject(resolvedDeps),
    devDependencies: sortObject(resolvedDeps),
  };

  // 5. Write to Disk
  fs.writeFileSync(
    path.join(props.outputDir, "package.json"),
    JSON.stringify(outPkg, null, 2),
  );
}

/**
 * Helper to sort dependencies alphabetically (Standard npm behavior)
 */
function sortObject(obj: Record<string, string>): Record<string, string> {
  return Object.keys(obj)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = obj[key];
        return acc;
      },
      {} as Record<string, string>,
    );
}

import ts from "typescript";
import { DependencyResolver } from "./utils/dependency-resolver";
import { SymbolCollector } from "./imports/collector";
import { generateImports } from "./utils/import-generator";


// --- Main Writer ---
export function writeAPI({
  config,
  program,
  dependencyResolver,
  api,
  collector,
}: {
  config: {
    outputDir: string;
    whitelistedPackages: string[];
    outputFile: string;
    packageName: string;
    version: string;
    description: string;
  };
  collector: SymbolCollector;
  program: ts.Program;
  dependencyResolver: DependencyResolver;
  api: ApiDefinition;
}) {
  const outputFile = path.join(config.outputDir, "src", config.outputFile);
  const imports = generateImports(
    collector,
    program,
    dependencyResolver,
    api,
    outputFile,
  );

  // --- 2. Build AST for API Definition ---
  // We want to build: export type API = { "/route": { "GET": { ... } } }
  const factory = ts.factory;
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const routeProperties: ts.TypeElement[] = [];

  for (const [route, methods] of Object.entries(api)) {
    const methodProperties: ts.TypeElement[] = [];

    for (const [method, def] of Object.entries(methods)) {
      const endpointMembers: ts.TypeElement[] = [];

      // Helper to add Request/Response members safely
      const addMember = (name: string, node: ts.TypeNode | undefined) => {
        if (!node) return;
        endpointMembers.push(
          factory.createPropertySignature(
            undefined,
            factory.createIdentifier(name), // Key
            undefined,
            factory.createTypeReferenceNode(node.getText()), // Value
          ),
        );
      };

      addMember("RequestParams", def.RequestParams);
      addMember("RequestBody", def.RequestBody);
      addMember("RequestQuery", def.RequestQuery);
      addMember("ResponseBody", def.ResponseBody);

      // Create the method property: "GET": { ... }
      methodProperties.push(
        factory.createPropertySignature(
          undefined,
          factory.createStringLiteral(method), // Use StringLiteral for safety (e.g. "GET")
          undefined,
          factory.createTypeLiteralNode(endpointMembers),
        ),
      );
    }

    // Create the route property: "/users": { ... }
    routeProperties.push(
      factory.createPropertySignature(
        undefined,
        factory.createStringLiteral(route), // Route string keys need quotes
        undefined,
        factory.createTypeLiteralNode(methodProperties),
      ),
    );
  }

  // Create the main export: export type API = { ... }
  const apiTypeAlias = factory.createTypeAliasDeclaration(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier("API"), // You can make this configurable via config.apiTypeName if needed
    undefined,
    factory.createTypeLiteralNode(routeProperties),
  );

  // --- 3. Print AST to String ---
  const resultFile = ts.createSourceFile(
    outputFile,
    "",
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );

  const apiDefinitionCode = printer.printNode(
    ts.EmitHint.Unspecified,
    apiTypeAlias,
    resultFile,
  );

  // --- 4. Write to File ---
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }

  const fileContent = imports + "\n\n" + apiDefinitionCode;
  fs.writeFileSync(outputFile, fileContent);

  // 3. Update Package JSON
  generatePackageJson({ ...config, workingDir: process.cwd() });
}
