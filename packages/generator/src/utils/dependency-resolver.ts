import path from "path";
import ts from "typescript";


export class DependencyResolver {
  private program: ts.Program;
  private host: ts.ModuleResolutionHost;
  private whitelist: string[];

  constructor(
    program: ts.Program,
    whitelist: string[],
    host: ts.ModuleResolutionHost = ts.sys
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
    symbol: ts.Symbol
  ): { module: string; isExternal: boolean; } | undefined {
    const decls = symbol.getDeclarations();
    if (!decls || decls.length === 0) return undefined;

    const sourceFile = decls[0].getSourceFile();

    if (this.program.isSourceFileDefaultLibrary(sourceFile)) {
      return undefined;
    }

    
    const isExternal = this.program.isSourceFileFromExternalLibrary(sourceFile);
    
    if (isExternal) {
      const packageName = this.resolvePackageName(sourceFile.fileName);
      if (packageName && this.whitelist.includes(packageName)) {
        return {
          module: packageName,
          isExternal: true,
        };
      }

      return undefined;
    }

    return { module: sourceFile.fileName, isExternal: false };
  }

  public resolvePackageName(filePath: string): string | undefined {
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
