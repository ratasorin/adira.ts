import ts from "typescript";

export interface ImportedSymbol {
  name: string;
  isDefault: boolean;
}

/**
 * Extracts all identifiers from a static ImportDeclaration node.
 *
 * Returns both:
 *  - `value`: runtime imports
 *  - `type`: type-only imports (`import type { ... }`)
 *
 * Note: dynamic imports (`import("...")`) are not handled.
 *
 * Examples:
 *   import foo from "x";                 → { value: ["foo"], type: [] }
 *   import { a, b as c } from "x";      → { value: ["a", "c"], type: [] }
 *   import * as utils from "x";          → { value: ["utils"], type: [] }
 *   import type { A, B } from "x";      → { value: [], type: ["A", "B"] }
 *   import foo, { type A, type B } from "x"; → { value: ["foo"], type: ["A", "B"] }
 *
 * @param node The ImportDeclaration AST node to inspect.
 * @returns Object with `value` and `type` arrays of imported names.
 */
export function getImportedIdentifiers(node: ts.ImportDeclaration): {
  value: ImportedSymbol[];
  type: ImportedSymbol[];
} {
  const value: ImportedSymbol[] = [];
  const type: ImportedSymbol[] = [];

  const clause = node.importClause;
  if (!clause) return { value, type };

  const isTypeOnlyClause = clause.isTypeOnly === true;

  // ------ Default import ------
  // import foo from "module"
  if (clause.name) {
    const name = clause.name.getText();
    if (isTypeOnlyClause) type.push({ name, isDefault: true });
    else value.push({ name, isDefault: true });
  }

  // ------ Named imports ------
  if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
    for (const element of clause.namedBindings.elements) {
      const name = element.name.getText();
      const isTypeOnly = element.isTypeOnly === true;

      if (isTypeOnly || isTypeOnlyClause) type.push({ name, isDefault: false });
      else value.push({ name, isDefault: false });
    }
  }

  // ------ Namespace import ------
  // import * as utils from "module"
  if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
    const name = clause.namedBindings.name.getText();
    if (isTypeOnlyClause) type.push({ name, isDefault: false });
    else value.push({ name, isDefault: false });
  }

  return { value, type };
}

export const trackImports = (
  file: string,
  node: ts.Node,
  tsConfig: ts.CompilerOptions,
  importMap: Record<string, ImportInfo>,
) => {
  /**
   * For every node like: `import x, { z } from 'y'`
   * we keep track of it's source-file by adding it to the importMap: `importMap['x'] = 'y'; importMap['z'] = 'y'`
   * Because we don't know what imports will be used as routers, we must add all nodes marked as "import declarations" (via `ts.isImportDeclaration(node)`)
   */
  if (
    ts.isImportDeclaration(node) &&
    node.importClause &&
    node.moduleSpecifier
  ) {
    // given import { mySpecialRouter, thisIsNotARouter } from 'library', this would be 'library'
    const importedModuleName = node.moduleSpecifier
      .getText()
      .replace(/['"]/g, "");

    // use the typescript module resolution to figure out the absolute path of 'library' (it can be inside node_modules or a local import)
    const importedModuleAbsolutePath = resolveImportToAbsolutePath(
      file,
      importedModuleName,
      tsConfig,
    );

    // if the module exists we can assign it's imports
    // "mySpecialRouter", "thisIsNotARouter" the full path: "home/user/.../node_modules/library/helper/index.js"
    if (importedModuleAbsolutePath) {
      const importedIdentifiers = getImportedIdentifiers(node);
      const possibleRouterImports = importedIdentifiers.value;
      for (const {
        name: possibleRouterImport,
        isDefault,
      } of possibleRouterImports) {
        importMap[possibleRouterImport] = {
          file: importedModuleAbsolutePath,
          isDefault,
        };
      }
    }
  }
};

export function detectMainAppRouter(
  node: ts.Node,
  checker: ts.TypeChecker,
): { router: ts.Symbol | undefined; prefix: string } | undefined {
  if (!ts.isExpressionStatement(node)) return undefined;
  const expr = node.expression;
  if (!ts.isCallExpression(expr)) return undefined;

  const { expression, arguments: args } = expr;

  if (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.getText() === "use" &&
    args.length >= 2
  ) {
    const [prefixArg, routerArg] = args;

    if (!ts.isStringLiteral(prefixArg)) return undefined;

    const symbol = checker.getSymbolAtLocation(routerArg);

    return {
      router: symbol,
      prefix: prefixArg.text,
    };
  }

  return undefined;
}

import fs from "fs";
import { ImportInfo } from "./types";
import { resolveImportToAbsolutePath } from "../utils";

/**
 * Resolves the actual absolute file and exported name of a handler.
 * Handles:
 * 1. Default imports (`import foo from './file'`)
 * 2. Named imports (`import { bar } from './file'`)
 * 3. Re-exports (`export { X as Y } from './other'`)
 * 4. Default export assignments (`export default foo`)
 * 5. Direct exports (`export const foo = ...`, `export function foo() {}`)
 *
 * @param handlerName The identifier used in the importing file (could be a default import)
 * @param importMap Maps identifier → { file: string, isDefault: boolean }
 * @param tsconfig TypeScript compiler options (for module resolution)
 * @returns { handlerPath, handlerName } or throws an error if not found
 */
export function findRouteHandlerDefiniton(
  handlerName: string,
  importMap: Record<string, ImportInfo>,
  tsconfig: ts.CompilerOptions,
): { handlerPath: string; handlerName: string } {
  const info = importMap[handlerName];
  if (!info) {
    throw new Error(`Handler "${handlerName}" not found in importMap`);
  }

  let currentFile = info.file;
  let originalExportName = info.isDefault ? "default" : handlerName;
  const chain: string[] = [currentFile];

  while (true) {
    const sourceText = fs.readFileSync(currentFile, "utf-8");
    const sourceFile = ts.createSourceFile(
      currentFile,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
    );

    let foundReExport: { module: string; exportName: string } | undefined;

    for (const node of sourceFile.statements) {
      // 1️⃣ Re-export: export { X as Y } from './other'
      if (
        ts.isExportDeclaration(node) &&
        node.exportClause &&
        node.moduleSpecifier &&
        ts.isNamedExports(node.exportClause)
      ) {
        for (const el of node.exportClause.elements) {
          const exportedName = el.name.getText(); // name seen by importers
          const origName = (el.propertyName ?? el.name).getText(); // actual name in source module
          if (exportedName === originalExportName) {
            foundReExport = {
              module: (node.moduleSpecifier as ts.StringLiteral).text,
              exportName: origName,
            };
            break;
          }
        }
      }

      // 2️⃣ Default export assignment: export default X
      if (
        ts.isExportAssignment(node) &&
        !node.isExportEquals &&
        originalExportName === "default"
      ) {
        if (ts.isIdentifier(node.expression)) {
          return {
            handlerPath: currentFile,
            handlerName: node.expression.getText(),
          };
        }
      }

      // 3️⃣ Direct named exports
      if (originalExportName !== "default") {
        if (
          ts.isVariableStatement(node) &&
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          for (const decl of node.declarationList.declarations) {
            if (
              ts.isIdentifier(decl.name) &&
              decl.name.getText() === originalExportName
            ) {
              return {
                handlerPath: currentFile,
                handlerName: originalExportName,
              };
            }
          }
        }

        if (
          ts.isFunctionDeclaration(node) &&
          node.name?.getText() === originalExportName &&
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          return { handlerPath: currentFile, handlerName: originalExportName };
        }

        if (
          ts.isClassDeclaration(node) &&
          node.name?.getText() === originalExportName &&
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          return { handlerPath: currentFile, handlerName: originalExportName };
        }
      }
    }

    // 4️⃣ Follow re-export if found
    if (!foundReExport) break;

    const nextFile = resolveImportToAbsolutePath(
      currentFile,
      foundReExport.module,
      tsconfig,
    );
    if (!nextFile) break;

    currentFile = nextFile;
    originalExportName = foundReExport.exportName;
    chain.push(currentFile);
  }

  throw new Error(
    `Failed to resolve handler "${handlerName}" (imported as "${info.isDefault ? "default" : handlerName}")\n` +
      `Last attempted export name: "${originalExportName}"\n` +
      `Files traversed:\n  - ${chain.join("\n  - ")}\n` +
      `Make sure the handler is exported in one of these files or re-exported properly.`,
  );
}
