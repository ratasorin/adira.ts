import fs from "fs";
import path from "path";
import { ApiDefinition, HandlerApiDefinition } from "src/handler/generate";

const OUTPUT_FILE_NAME = "api.d.ts";

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
import { DependencyResolver } from "./utils";

/**
 * Generates valid TypeScript import statements for the provided symbols
 * relative to a target file path (e.g., src/index.d.ts).
 */
export function generateImports(
  program: ts.Program,
  dependencyResolver: DependencyResolver,
  apiDefiniton: ApiDefinition,
  targetFilePath: string, // The absolute path where this file will live
): string {
  const endpoints: HandlerApiDefinition[] = Object.values(apiDefiniton).flatMap(
    (v) => Object.values(v),
  );
  // 1. Flatten and Deduplicate Symbols
  const uniqueSymbols = new Set<ts.Symbol>();

  for (const group of endpoints) {
    Object.values(group).forEach((symbol) => {
      if (symbol) uniqueSymbols.add(symbol);
    });
  }

  // 2. Group Symbols by Module Specifier (File Path or Package Name)
  // Map<ModuleSpecifier, Set<SymbolName>>
  const importsMap = new Map<string, Set<string>>();

  const targetDir = path.dirname(targetFilePath);

  for (const symbol of uniqueSymbols) {
    // A symbol might have multiple declarations, we usually take the first value-declaration or just the first one.
    const decl = symbol.declarations?.[0];
    if (!decl) continue;

    const sourceFile = decl.getSourceFile();
    let moduleSpecifier: string | undefined;

    // Case A: External Library (node_modules)
    if (program.isSourceFileFromExternalLibrary(sourceFile)) {
      // Robust way to find package name: traverse up until package.json
      moduleSpecifier = dependencyResolver.resolvePackageName(
        sourceFile.fileName,
      );
    }
    // Case B: Local File
    else {
      // Calculate relative path: ./src/index.d.ts -> ./src/types.ts = ./types
      let relativePath = path.relative(targetDir, sourceFile.fileName);

      // Ensure local paths start with ./ or ../
      if (!relativePath.startsWith(".")) {
        relativePath = "./" + relativePath;
      }

      // Strip extensions (.d.ts, .ts)
      moduleSpecifier = relativePath.replace(/(\.d\.ts|\.ts)$/, "");

      // Normalize slashes for Windows
      moduleSpecifier = moduleSpecifier.split(path.sep).join("/");
    }

    if (moduleSpecifier && !importsMap.has(moduleSpecifier)) {
      importsMap.set(moduleSpecifier, new Set());
    }

    // Handle "Default" exports vs "Named" exports
    // If name is "default" or "export=", handling is complex.
    // For this snippet, we assume named exports which is standard for DTOs.
    importsMap.get(moduleSpecifier || "")!.add(symbol.name);
  }

  // 3. Create AST Nodes for Imports
  const factory = ts.factory;
  const nodes: ts.Node[] = [];

  // Sort modules for deterministic output
  const sortedModules = Array.from(importsMap.keys()).sort();

  for (const modulePath of sortedModules) {
    const symbolNames = Array.from(importsMap.get(modulePath)!).sort();

    const importSpecifiers = symbolNames.map((name) =>
      factory.createImportSpecifier(
        false, // isTypeOnly
        undefined, // propertyName (alias)
        factory.createIdentifier(name), // name
      ),
    );

    const importDecl = factory.createImportDeclaration(
      undefined, // modifiers
      factory.createImportClause(
        false, // isTypeOnly
        undefined, // name (default import)
        factory.createNamedImports(importSpecifiers), // named bindings
      ),
      factory.createStringLiteral(modulePath),
      undefined, // assertClause
    );

    nodes.push(importDecl);
  }

  // 4. Print
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const resultFile = ts.createSourceFile(
    "temp.ts",
    "",
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );

  const result = printer.printList(
    ts.ListFormat.MultiLine,
    factory.createNodeArray(nodes),
    resultFile,
  );

  return result;
}

// --- Main Writer ---
export function writeAPI({
  config,
  program,
  dependencyResolver,
  api,
}: {
  config: {
    outputDir: string;
    whitelistedPackages: string[];
    packageName: string;
    version: string;
    description: string;
  };
  program: ts.Program;
  dependencyResolver: DependencyResolver;
  api: ApiDefinition;
}) {
  const outputFile = path.join(config.outputDir, "src", OUTPUT_FILE_NAME);
  const imports = generateImports(program, dependencyResolver, api, outputFile);

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
      const addMember = (name: string, symbol?: ts.Symbol) => {
        if (!symbol) return;
        endpointMembers.push(
          factory.createPropertySignature(
            undefined,
            factory.createIdentifier(name), // Key: RequestBody
            undefined,
            factory.createTypeReferenceNode(symbol.name), // Value: User
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
    "temp.ts",
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
  if (!fs.existsSync(outputFile)) {
    fs.mkdirSync(outputFile, { recursive: true });
  }

  const fileContent = imports + "\n\n" + apiDefinitionCode;
  fs.writeFileSync(outputFile, fileContent);

  // 3. Update Package JSON
  generatePackageJson({ ...config, workingDir: process.cwd() });
}
