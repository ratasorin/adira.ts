import fs from "fs";
import path from "path";
import ts from "typescript";
import { SymbolCollector } from "../imports/collector";
import { DependencyResolver } from ".";

/**
 * Creates a real file system structure in ./dist/temp-tests and runs the collector against it.
 */
export function createTestProgram(
  where: string,
  files: Record<string, string>,
  entryPointNames: string[], // Names of symbols you want to retrieveimmediately
  whitelistedPackageNames: string[] = [],
) {
  // 1. Setup a clean test directory
  const testRoot = path.resolve(
    process.cwd(),
    where + "dist/temp-tests_" + Date.now(),
  );

  if (fs.existsSync(testRoot)) {
    fs.rmSync(testRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(testRoot, { recursive: true });

  // 2. Write all files to disk
  Object.entries(files).forEach(([virtualPath, content]) => {
    // Handle paths starting with / by removing the leading slash to make them relative to testRoot
    const relativePath = virtualPath.startsWith("/")
      ? virtualPath.slice(1)
      : virtualPath;
    const fullPath = path.join(testRoot, relativePath);

    // Ensure directory exists
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });

    // Write file
    fs.writeFileSync(fullPath, content);
  });

  // 3. Configure TypeScript to run in this directory
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    declaration: true,
    emitDeclarationOnly: true,
    skipLibCheck: true,
    strict: true,
    baseUrl: testRoot, // Critical: Roots imports to this folder
    paths: { "*": ["*"] },
  };

  // 4. Create Program (Standard Disk-Based)
  const host = ts.createCompilerHost(compilerOptions);

  // We need to tell the host to look in our test folder for current directory resolution
  const originalCwd = process.cwd();
  host.getCurrentDirectory = () => testRoot;

  // Locate the entry point (usually index.ts, or the first .ts file found)
  const rootFiles = Object.keys(files)
    .filter((f) => f.endsWith(".ts") && !f.includes("node_modules"))
    .map((f) => path.join(testRoot, f.startsWith("/") ? f.slice(1) : f));

  const program = ts.createProgram(rootFiles, compilerOptions, host);
  const checker = program.getTypeChecker();

  // 5. Initialize your tools
  const resolver = new DependencyResolver(
    program,
    whitelistedPackageNames,
    host as any,
  );
  const collector = new SymbolCollector(program, resolver);

  // 6. Resolve Entry Point Symbols
  const symbols = new Set<ts.Symbol>();

  // We iterate over non-library source files to find the matching symbols
  for (const sourceFile of program.getSourceFiles()) {
    if (program.isSourceFileFromExternalLibrary(sourceFile)) continue;

    ts.forEachChild(sourceFile, (node) => {
      // Check standard declaration types that have names
      if (
        (ts.isInterfaceDeclaration(node) ||
          ts.isClassDeclaration(node) ||
          ts.isTypeAliasDeclaration(node) ||
          ts.isEnumDeclaration(node) ||
          ts.isFunctionDeclaration(node) ||
          ts.isModuleDeclaration(node)) &&
        node.name &&
        entryPointNames.includes(node.name.getText())
      ) {
        const symbol = checker.getSymbolAtLocation(node.name);
        if (symbol) {
          symbols.add(symbol);
        }
      }

      // Handle "export const X = ..." wrapped in VariableStatement
      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach((decl) => {
          if (
            decl.name &&
            ts.isIdentifier(decl.name) &&
            entryPointNames.includes(decl.name.text)
          ) {
            const symbol = checker.getSymbolAtLocation(decl.name);
            if (symbol) symbols.add(symbol);
          }
        });
      }
    });
  }

  if (symbols.size === 0 && entryPointNames.length > 0) {
    console.warn(
      `WARNING: No symbols found for names: [${entryPointNames.join(", ")}] in files: ${rootFiles.join(", ")}`,
    );
  }

  return {
    collector,
    program,
    symbols,
  };
}

export const has = (set: Set<ts.Symbol>, name: string) =>
  [...set].some((s) => s.name === name);

export const getSymbolsName = (set: Set<ts.Symbol>) =>
  new Set([...set].map((s) => s.name));

export const printSymbols = (set: Set<ts.Symbol>) => {
  console.log("Collected Symbols:", [...set].map((s) => s.name).join(", "));
};

/**
 * Creates a real file system structure, compiles it, and searches for a specific TypeNode
 * matching the provided text fragment.
 */
export function createTypeNodeTestProgram(
  where: string,
  files: Record<string, string>,
  targetTypeNodeText: string,
  whitelistedPackageNames: string[] = [],
) {
  // 1. Setup a clean test directory
  const testRoot = path.resolve(
    process.cwd(),
    where + "dist/temp-tests_node_" + Date.now(),
  );

  if (fs.existsSync(testRoot)) {
    fs.rmSync(testRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(testRoot, { recursive: true });

  // 2. Write all files to disk
  Object.entries(files).forEach(([virtualPath, content]) => {
    const relativePath = virtualPath.startsWith("/")
      ? virtualPath.slice(1)
      : virtualPath;
    const fullPath = path.join(testRoot, relativePath);

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  });

  // 3. Configure TypeScript
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    declaration: true,
    emitDeclarationOnly: true,
    skipLibCheck: true,
    strict: true,
    baseUrl: testRoot,
    paths: { "*": ["*"] },
  };

  // 4. Create Program
  const host = ts.createCompilerHost(compilerOptions);
  const originalCwd = process.cwd();
  host.getCurrentDirectory = () => testRoot;

  const rootFiles = Object.keys(files)
    .filter((f) => f.endsWith(".ts") && !f.includes("node_modules"))
    .map((f) => path.join(testRoot, f.startsWith("/") ? f.slice(1) : f));

  const program = ts.createProgram(rootFiles, compilerOptions, host);

  // 5. Initialize tools
  const resolver = new DependencyResolver(
    program,
    whitelistedPackageNames,
    host as any,
  );
  const collector = new SymbolCollector(program, resolver);

  // 6. Locate the specific TypeNode
  let foundNode: ts.TypeNode | undefined;

  // Helper to walk the tree
  const visit = (node: ts.Node) => {
    if (foundNode) return; // Stop if already found

    // Check if this is a TypeNode and matches our target text
    // We use getText() to see the full representation (e.g. "Backend.Infer<T>")
    if (ts.isTypeNode(node) && node.getText().includes(targetTypeNodeText)) {
      foundNode = node;
      return;
    }

    ts.forEachChild(node, visit);
  };

  for (const sourceFile of program.getSourceFiles()) {
    if (program.isSourceFileFromExternalLibrary(sourceFile)) continue;
    visit(sourceFile);
    if (foundNode) break;
  }

  if (!foundNode) {
    throw new Error(
      `Could not find any TypeNode containing text: "${targetTypeNodeText}" in files: ${rootFiles.join(", ")}`,
    );
  }

  return {
    collector,
    program,
    typeNode: foundNode,
  };
}
