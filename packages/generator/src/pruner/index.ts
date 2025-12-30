import ts from "typescript";
import fs from "fs";

export class Pruner {
  constructor(
    private checker: ts.TypeChecker,
    private keepSet: Set<ts.Symbol>,
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
          if (symbol && !this.keepSet.has(symbol)) {
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
          if (symbol && !this.keepSet.has(symbol)) {
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
              return s && this.keepSet.has(s);
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
              return s && this.keepSet.has(s);
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
            if (!s || !this.keepSet.has(s)) {
              keptName = undefined;
            }
          }

          // 5b. Check Named Bindings (NamedImports or NamespaceImport)
          if (keptNamedBindings) {
            if (ts.isNamedImports(keptNamedBindings)) {
              const keptElements = keptNamedBindings.elements.filter((el) => {
                const s = this.checker.getSymbolAtLocation(el.name);
                return s && this.keepSet.has(s);
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
              if (!s || !this.keepSet.has(s)) {
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
          if (s && !this.keepSet.has(s)) {
            return undefined;
          }
        }

        // --- 7. Import Equals (import A = require('./b')) ---
        else if (ts.isImportEqualsDeclaration(node)) {
          const s = this.checker.getSymbolAtLocation(node.name);
          if (s && !this.keepSet.has(s)) {
            return undefined;
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
