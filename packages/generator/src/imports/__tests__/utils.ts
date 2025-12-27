import fs from "fs";
import path from "path";
import ts from "typescript";
import { SymbolCollector } from "../collector";
import { DependencyResolver } from "../../utils";

/**
 * Creates a real file system structure in ./dist/temp-tests and runs the collector against it.
 */
export function createTestProgram(
  files: Record<string, string>,
  whitelist: string[] = [],
) {
  // 1. Setup a clean test directory
  const testRoot = path.resolve(__dirname, "dist/temp-tests_" + Date.now());

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
  // We use the standard host (ts.createCompilerHost w/o arguments uses ts.sys which reads disk)
  const host = ts.createCompilerHost(compilerOptions);

  // We need to tell the host to look in our test folder for current directory resolution
  const originalCwd = process.cwd();
  host.getCurrentDirectory = () => testRoot;

  // Locate the entry point (usually index.ts, or the first .ts file found)
  const rootFiles = Object.keys(files)
    .filter((f) => f.endsWith(".ts") && !f.includes("node_modules"))
    .map((f) => path.join(testRoot, f.startsWith("/") ? f.slice(1) : f));

  const program = ts.createProgram(rootFiles, compilerOptions, host);

  // 5. Initialize your tools
  const resolver = new DependencyResolver(program, whitelist, host as any);
  const collector = new SymbolCollector(program, resolver);

  return {
    collector,
    program,
    // Helper to get absolute path for assertions if needed
    resolvePath: (p: string) =>
      path.join(testRoot, p.startsWith("/") ? p.slice(1) : p),
  };
}

export const has = (set: Set<ts.Symbol>, name: string) =>
  [...set].some((s) => s.name === name);

export const getSymbols = (set: Set<ts.Symbol>) =>
  new Set([...set].map((s) => s.name));
