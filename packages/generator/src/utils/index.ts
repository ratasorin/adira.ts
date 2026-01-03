import path from "path";
import glob from "fast-glob";
import ts from "typescript";

export function findProjectConfig(): string {
  const searchPath = process.cwd();

  // 1. Locate the file path
  const configPath = ts.findConfigFile(
    searchPath,
    ts.sys.fileExists,
    "tsconfig.json", // You can also check for 'tsconfig.base.json' if needed
  );

  if (!configPath) {
    throw new Error("Could not find a valid 'tsconfig.json'.");
  }

  return configPath;
}

export function getParsedCommandLine(configPath: string): ts.ParsedCommandLine {
  // Read the file content
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

  if (configFile.error) {
    const message = ts.formatDiagnostics(
      [configFile.error],
      ts.createCompilerHost({}),
    );
    throw new Error(message);
  }

  // Parse the content, resolving "extends" and converting strings to CompilerOptions
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
  );

  return parsedConfig;
}

/**
 * Correctly retrieves the SourceFiles for a project by respecting
 * the user's tsconfig.json (includes, excludes, and files).
 */
export function createProject(parsedConfig: ts.ParsedCommandLine): {
  files: readonly ts.SourceFile[];
  program: ts.Program;
} {
  // 1. Create the program using the files and options found in tsconfig
  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
  });

  // 2. Get all source files
  const allFiles = program.getSourceFiles();

  const userFiles = allFiles.filter((file) => {
    return (
      !file.isDeclarationFile &&
      !file.fileName.includes("node_modules") &&
      !program.isSourceFileDefaultLibrary(file) &&
      !program.isSourceFileFromExternalLibrary(file)
    );
  });

  program.getTypeChecker();

  return { files: userFiles, program };
}

export function readTsConfig(tsConfigPath: string): ts.CompilerOptions {
  const compilerOptions: ts.CompilerOptions = tsConfigPath
    ? ts.readConfigFile(tsConfigPath, ts.sys.readFile).config.compilerOptions ||
      {}
    : {};

  return compilerOptions;
}

/**
 * Given an import: `import A from '../../A'`, we want the absolute file location of 'A.ts' so
 * we can open it, read the code and decide what to do with `A`
 * @param containingFile - The current file trying to use the object `A`
 * @param importPath - The relative path of the imported object `A` (i.e: '../../A')
 * @param tsConfig
 * @returns The full file path of the object being imported (i.e: '/home/projects/src/models/A.ts')
 */
export function resolveImportToAbsolutePath(
  containingFile: string,
  importPath: string,
  tsConfig: ts.CompilerOptions,
): string | undefined {
  const result = ts.resolveModuleName(
    importPath,
    containingFile,
    tsConfig,
    ts.sys,
  );

  return result.resolvedModule?.resolvedFileName;
}

export function matchHandlerDeclaration(
  node: ts.Node,
  handlerName: string,
): { parameters: ts.NodeArray<ts.ParameterDeclaration> } | undefined {
  // Case 1: declare function foo(req, res): ReturnType;
  if (
    ts.isFunctionDeclaration(node) &&
    node.name?.text === handlerName &&
    node.body === undefined // declaration-only
  ) {
    return { parameters: node.parameters };
  }

  // Case 2: declare const foo: (req, res) => ReturnType;
  if (ts.isVariableStatement(node)) {
    // Must be a declare statement in .d.ts
    if (!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)) {
      return undefined;
    }

    for (const decl of node.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name)) continue;
      if (decl.name.text !== handlerName) continue;

      // Explicitly require a type annotation
      if (!decl.type) continue;

      // Only allow function type nodes
      if (ts.isFunctionTypeNode(decl.type)) {
        return { parameters: decl.type.parameters };
      }
    }
  }

  return undefined;
}

export function extractTypeGeneric(
  node: ts.TypeNode | undefined,
  index: number,
): ts.TypeNode | undefined {
  if (!node) return undefined;

  // Unwrap parentheses
  while (ts.isParenthesizedTypeNode(node)) {
    node = node.type;
  }

  // TypeReferenceNode<T, A, B, C>
  if (
    ts.isTypeReferenceNode(node) &&
    node.typeArguments &&
    node.typeArguments.length > index
  ) {
    return node.typeArguments[index];
  }

  return undefined;
}

/**
 * Compiles the source files into .d.ts files in the target directory.
 * @param fileNames - List of absolute paths to source files (from Phase A)
 * @param options - The user's original CompilerOptions
 * @param outputDir - Where to place the transpiled shared folder
 */
export async function compileProject(
  fileNames: string[],
  options: ts.CompilerOptions,
  outputDir: string,
): Promise<ts.Program> {
  // Override options for Phase B preparation
  const compilerOptions: ts.CompilerOptions = {
    ...options,
    declaration: true,
    emitDeclarationOnly: true,
    outDir: outputDir,
    // Ensure we don't accidentally check the whole project's types
    // if we just want the output
    skipLibCheck: true,
    incremental: false,
  };

  // Create a compiler host and program
  const host = ts.createCompilerHost(compilerOptions);
  const program = ts.createProgram(fileNames, compilerOptions, host);

  // Perform the emit
  const emitResult = program.emit();

  // Check for immediate emit errors (like file system permissions)
  const allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  if (allDiagnostics.length > 0) {
    const formatted = ts.formatDiagnosticsWithColorAndContext(allDiagnostics, {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getNewLine: () => ts.sys.newLine,
    });

    // We log warnings, but we don't necessarily stop unless the emit failed
    console.warn("Compilation Warnings during .d.ts generation:\n", formatted);
  }

  if (emitResult.emitSkipped) {
    throw new Error("Failed to emit declaration files for the shared folder.");
  }

  // 1. Find all .d.ts files in the output directory
  const declarationFiles = ts.sys.readDirectory(
    outputDir,
    [".d.ts"], // extensions to include
    undefined, // excludes
    undefined, // includes
  );

  // 2. Define options for the new program
  // We usually want these to be "Type Check only" options
  const dtsOptions: ts.CompilerOptions = {
    ...options,
    allowJs: true,
    checkJs: true,
    noEmit: true, // We only want to analyze, not emit again
    baseUrl: outputDir, // Important for resolving internal paths in the output
  };

  // 3. Create the second program
  const declarationProgram = ts.createProgram({
    rootNames: declarationFiles,
    options: dtsOptions,
  });

  // Optional: Force parent pointers if you need .getText()
  declarationProgram.getTypeChecker();

  return declarationProgram;
}
