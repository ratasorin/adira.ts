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
export function getProjectFiles(
  parsedConfig: ts.ParsedCommandLine,
): readonly ts.SourceFile[] {
  // 1. Create the program using the files and options found in tsconfig
  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
  });

  // 2. Get all source files
  const allFiles = program.getSourceFiles();

  // 3. Filter out standard library files (like lib.d.ts, lib.es5.d.ts)
  // and node_modules, so you only process the user's actual source code.
  return allFiles.filter((file) => {
    return !file.isDeclarationFile && !file.fileName.includes("node_modules");
  });
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
  // Case 1: function foo(req, res): void; (Standard Function Declaration)
  if (ts.isFunctionDeclaration(node) && node.name?.text === handlerName) {
    return { parameters: node.parameters };
  }

  // Case 2: const foo: (req, res) => void; (Variable Declaration in .d.ts)
  if (ts.isVariableStatement(node)) {
    for (const decl of node.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === handlerName) {
        // Check for .d.ts style: const handler: (req, res) => void
        if (decl.type && ts.isFunctionTypeNode(decl.type)) {
          return { parameters: decl.type.parameters };
        }

        // Check for .ts style: const handler = (req, res) => {}
        if (
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) ||
            ts.isFunctionExpression(decl.initializer))
        ) {
          return { parameters: decl.initializer.parameters };
        }
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

export class DependencyResolver {
  private program: ts.Program;
  private host: ts.ModuleResolutionHost;
  private whitelist: string[];

  constructor(
    program: ts.Program,
    whitelist: string[],
    host: ts.ModuleResolutionHost = ts.sys,
  ) {
    this.program = program;
    this.host = host;
    this.whitelist = whitelist;
  }

  /**
   * Given a symbol `Ref` used in the code: `type X = Ref<Y>`, we want to know if it's a local or external declaration
   *
   * To do this, we get the "birthplace" of `Ref`: `const sourceFile = symbol.getDeclarations().getSourecFile()`
   *
   * If it's birthplace is inside node_modules, `Ref` is external. If it's whitelisted, accept it. If not reject it.
   * If accepted, we are interested in the name of `Ref`'s module (i.e: "@refs/land" if `Ref` was imported like: `import Ref from '@refs/land'`) as defined in it's package.json (to do this we use: `resolvePackageName("Ref")`)
   *
   * If it's birthplace is inside our current project return the filename and mark it as local
   * @param symbol - The used `Ref`
   * @returns `{ module: string, isExternal: boolean }`- for external whitelisted modules or internals. `undefined`- for external, blacklisted modules
   */
  public getModuleInfo(
    symbol: ts.Symbol,
  ): { module: string; isExternal: boolean } | undefined {
    const decls = symbol.getDeclarations();
    if (!decls || decls.length === 0) return undefined;

    const sourceFile = decls[0].getSourceFile();

    if (this.program.isSourceFileDefaultLibrary(sourceFile)) {
      return undefined;
    }

    const isExternal = sourceFile.fileName.includes("node_modules");

    if (isExternal) {
      const packageName = this.resolvePackageName(sourceFile.fileName);
      console.log({ isExternal, packageName, symbol: symbol.getName() });
      if (packageName && this.whitelist.includes(packageName)) {
        return {
          module: packageName,
          isExternal: true,
        };
      }

      return undefined;
    }

    console.log({
      isExternal,
      sourceFile: sourceFile.fileName,
      symbol: symbol.getName(),
    });
    return { module: sourceFile.fileName, isExternal: false };
  }

  private resolvePackageName(filePath: string): string | undefined {
    let currentDir = path.dirname(filePath);

    // Stop only when we reach the root of the file system (e.g. "/" or "C:\")
    while (currentDir !== path.dirname(currentDir)) {
      const pjPath = path.join(currentDir, "package.json");

      if (this.host.fileExists(pjPath)) {
        try {
          const content = this.host.readFile(pjPath);
          if (content) {
            const pkg = JSON.parse(content);
            return pkg.name;
          }
        } catch {
          // If JSON is malformed, we keep climbing or exit
          return undefined;
        }
      }

      currentDir = path.dirname(currentDir);
    }

    return undefined;
  }
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
): Promise<string> {
  const outDir = path.join(outputDir, "src");

  // Override options for Phase B preparation
  const compilerOptions: ts.CompilerOptions = {
    ...options,
    declaration: true,
    emitDeclarationOnly: true,
    outDir,
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

  return outDir;
}
