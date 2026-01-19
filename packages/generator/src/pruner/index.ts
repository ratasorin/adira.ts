import ts from "typescript";
import fs from "fs";
import { printSymbols } from "../utils/tests";

export class SymbolPruner {
  constructor(
    private checker: ts.TypeChecker,
    private keepSet: Set<ts.Symbol>,
    private program: ts.Program,
  ) {}

  /**
   * Prunes the file in place.
   * - If the file has remaining content, it overwrites the file on disk.
   * - If the file is empty after pruning, it deletes the file from disk.
   */
  public save(sourceFile: ts.SourceFile): void {
    const output = this.prune(sourceFile);

    // Check if the output is effectively empty
    if (output.trim().length === 0) {
      if (fs.existsSync(sourceFile.fileName)) {
        fs.unlinkSync(sourceFile.fileName);
      }
    } else {
      fs.writeFileSync(sourceFile.fileName, output);
    }
  }

  /**
   * Directly transforms and prints a source file, bypassing program.emit().
   * This allows processing .d.ts files directly.
   */
  public prune(sourceFile: ts.SourceFile): string {
    // 1. Run the transformation
    const result = ts.transform(sourceFile, [this.transform()]);

    // 2. Get the transformed AST
    const transformedSourceFile = result.transformed[0] as ts.SourceFile;

    // 3. Print the AST back to a string
    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
      removeComments: false,
    });

    // dispose() is important to release memory used by the transformation result
    const output = printer.printFile(transformedSourceFile);
    result.dispose();

    return output;
  }

  /**
   * Helper to determine if a symbol belongs to the TS default library (e.g. Date, Promise, etc.)
   */
  private isDefaultLibrarySymbol(symbol: ts.Symbol): boolean {
    if (!symbol.declarations || symbol.declarations.length === 0) return false;

    // Check if any declaration of this symbol is in a default library file
    return symbol.declarations.every((decl) =>
      this.program.isSourceFileDefaultLibrary(decl.getSourceFile()),
    );
  }

  private shouldKeepSymbol(symbol: ts.Symbol | undefined): boolean {
    if (!symbol) return false;

    // 1. Is it in our keepSet (explicitly crawled)?
    if (this.keepSet.has(symbol)) return true;

    // 2. Is it a built-in global like Date, Promise, etc?
    if (this.isDefaultLibrarySymbol(symbol)) return true;

    // 3. Is it a Type Parameter (like T in Map<T>)?
    if (symbol.flags & ts.SymbolFlags.TypeParameter) return true;

    return false;
  }
  /**
   * Creates a TransformerFactory to be used with program.emit().
   * Handles pruning of Declarations, Imports, Exports, and Variables.
   */
  private transform(): ts.TransformerFactory<ts.SourceFile | ts.Bundle> {
    const factory = ts.factory;

    return (context: ts.TransformationContext) => {
      const visit: ts.Visitor = (node: ts.Node): ts.Node | undefined => {
        // --- 1. Standard Named Declarations ---
        // Handles: Class, Interface, TypeAlias, Enum, Module (Namespace)
        if (
          ts.isClassDeclaration(node) ||
          ts.isInterfaceDeclaration(node) ||
          ts.isTypeAliasDeclaration(node) ||
          ts.isEnumDeclaration(node) ||
          ts.isModuleDeclaration(node)
        ) {
          if (!node.name) return undefined; // Anonymous default exports handled in ExportAssignment

          const symbol = this.checker.getSymbolAtLocation(node.name);
          if (symbol && !this.shouldKeepSymbol(symbol)) {
            return undefined;
          }
        }

        // --- 2. Function Declarations ---
        // In .d.ts, these are ambient signatures (no body).
        // Note: Multiple function overloads share the same Symbol.
        // If the symbol is kept, ALL overload signatures are preserved.
        else if (ts.isFunctionDeclaration(node)) {
          if (!node.name) return undefined;

          const symbol = this.checker.getSymbolAtLocation(node.name);
          if (symbol && !this.shouldKeepSymbol(symbol)) {
            return undefined;
          }
        }

        // --- 3. Variable Statements ---
        // Pattern: export declare const A: Type;
        // In .d.ts, there are no initializers, so no complex destructuring.
        else if (ts.isVariableStatement(node)) {
          const keptDecls = node.declarationList.declarations.filter((decl) => {
            // Strict check: .d.ts files must use simple Identifiers for variable names
            if (ts.isIdentifier(decl.name)) {
              const s = this.checker.getSymbolAtLocation(decl.name);
              return s && this.shouldKeepSymbol(s);
            }
            // It's impossible to encounter a BindingPattern (destructuring) in a .d.ts!
            return false;
          });

          // If no declarations remain, drop the entire statement
          if (keptDecls.length === 0) return undefined;

          // If some declarations were pruned, update the statement
          if (keptDecls.length !== node.declarationList.declarations.length) {
            return factory.updateVariableStatement(
              node,
              node.modifiers, // Preserves 'export', 'declare' flags
              factory.updateVariableDeclarationList(
                node.declarationList,
                keptDecls,
              ),
            );
          }
        }

        // --- 4. Export Declarations (Re-exports) ---
        // Pattern: export { A, B } from './c';
        else if (ts.isExportDeclaration(node)) {
          if (!node.exportClause) return node; // Keep 'export * from "mod"'

          if (ts.isNamedExports(node.exportClause)) {
            const keptElements = node.exportClause.elements.filter((el) => {
              const s = this.checker.getSymbolAtLocation(el.name);
              return s && this.shouldKeepSymbol(s);
            });

            if (keptElements.length === 0) return undefined;

            if (keptElements.length !== node.exportClause.elements.length) {
              return factory.updateExportDeclaration(
                node,
                node.modifiers,
                node.isTypeOnly,
                factory.updateNamedExports(node.exportClause, keptElements),
                node.moduleSpecifier,
                node.assertClause,
              );
            }
          }
        }

        // --- 5. Import Declarations ---
        // Pattern: import { A } from './b';
        else if (ts.isImportDeclaration(node)) {
          if (!node.importClause) return node; // Keep side-effect imports?

          const clause = node.importClause;
          let keptName = clause.name; // Default import (import A from ...)
          let keptNamedBindings = clause.namedBindings;

          // 5a. Check Default Import
          if (keptName) {
            const s = this.checker.getSymbolAtLocation(keptName);
            if (!s || !this.shouldKeepSymbol(s)) {
              keptName = undefined;
            }
          }

          // 5b. Check Named Bindings (NamedImports or NamespaceImport)
          if (keptNamedBindings) {
            if (ts.isNamedImports(keptNamedBindings)) {
              const keptElements = keptNamedBindings.elements.filter((el) => {
                const s = this.checker.getSymbolAtLocation(el.name);
                return s && this.shouldKeepSymbol(s);
              });

              if (keptElements.length === 0) {
                keptNamedBindings = undefined;
              } else if (
                keptElements.length !== keptNamedBindings.elements.length
              ) {
                keptNamedBindings = factory.updateNamedImports(
                  keptNamedBindings,
                  keptElements,
                );
              }
            } else if (ts.isNamespaceImport(keptNamedBindings)) {
              // import * as NS from ...
              const s = this.checker.getSymbolAtLocation(
                keptNamedBindings.name,
              );
              if (!s || !this.shouldKeepSymbol(s)) {
                keptNamedBindings = undefined;
              }
            }
          }

          // If nothing is left, drop the import
          if (!keptName && !keptNamedBindings) return undefined;

          // Update if changed
          if (
            keptName !== clause.name ||
            keptNamedBindings !== clause.namedBindings
          ) {
            return factory.updateImportDeclaration(
              node,
              node.modifiers,
              factory.updateImportClause(
                clause,
                clause.isTypeOnly,
                keptName,
                keptNamedBindings,
              ),
              node.moduleSpecifier,
              node.assertClause,
            );
          }
        }

        // --- 6. Export Assignments (export default X) ---
        else if (ts.isExportAssignment(node)) {
          const s = this.checker.getSymbolAtLocation(node.expression);
          if (s && !this.shouldKeepSymbol(s)) {
            return undefined;
          }
        }

        // --- 7. Import Equals (import A = require('./b')) ---
        else if (ts.isImportEqualsDeclaration(node)) {
          const s = this.checker.getSymbolAtLocation(node.name);
          if (s && !this.shouldKeepSymbol(s)) {
            return undefined;
          }
        }

        // --- 8. DEEP SANITIZATION: Type References ---
        // This handles: interface A { prop: Bad }, type B = Good & Bad, etc.
        else if (ts.isTypeReferenceNode(node)) {
          const typeNameText = node.typeName.getText();
          if (
            typeNameText === "Serialize" ||
            typeNameText.endsWith(".Serialize")
          ) {
            // Check if we have exactly 2 type arguments: <Original, Serialized>
            if (node.typeArguments && node.typeArguments.length === 2) {
              // Replace the entire 'Serialize<A, B>' node with 'B'
              // We must recursively visit 'B' to ensure it doesn't contain other disallowed types!
              return ts.visitNode(node.typeArguments[1], visit) as ts.TypeNode;
            }
          }

          // 1. Resolve the symbol for the type name (e.g., "Bad")
          const symbol = this.checker.getSymbolAtLocation(node.typeName);

          // 2. If it's a generic parameter (e.g., T in <T>), it won't be in keepSet
          // but should be kept. Generally, local type parameters don't have 'declarations'
          // reachable via normal crawl unless checked specifically.
          // However, for SymbolPruner context, checking if it is a TypeParameter is a safe guard.
          const isTypeParameter =
            symbol && symbol.flags & ts.SymbolFlags.TypeParameter;

          // 3. If symbol exists, is not a generic type param, and NOT in keepSet -> Sanitized
          if (symbol && !isTypeParameter && !this.shouldKeepSymbol(symbol)) {
            // Replace with 'unknown'
            return factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
          }
        }

        // --- 9. Heritage Clauses (extends Bad) ---
        // If we extend a blacklisted class/interface, we must remove that clause entirely,
        // otherwise `extends unknown` is a syntax error.
        else if (ts.isHeritageClause(node)) {
          const validTypes = node.types.filter((t) => {
            // Check the expression (e.g., "Bad" in "extends Bad")
            const symbol = this.checker.getSymbolAtLocation(t.expression);
            return !symbol || this.shouldKeepSymbol(symbol);
          });

          if (validTypes.length === 0) return undefined; // Remove "extends ..." block entirely

          if (validTypes.length !== node.types.length) {
            return factory.updateHeritageClause(
              node,
              factory.createNodeArray(validTypes),
            );
          }
        }

        return ts.visitEachChild(node, visit, context);
      };

      return (sourceFile: ts.SourceFile | ts.Bundle) => {
        return ts.visitNode(sourceFile, visit) as ts.SourceFile | ts.Bundle;
      };
    };
  }
}
