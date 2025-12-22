import ts from "typescript";
import path from "path";
import { DependencyResolver } from "../utils";

export class ImportCollector {
  private checker: ts.TypeChecker;
  // Map of moduleIdentifier -> Set of SymbolNames
  // Example: "./models/Invoice" -> Set { "IInvoice", "InvoiceStatus" }
  private importMap: Map<string, Set<string>> = new Map();

  constructor(
    private program: ts.Program,
    private resolver: DependencyResolver,
    private sharedSrcRoot: string, // The absolute path to shared/src
  ) {
    this.checker = program.getTypeChecker();
  }

  /**
   * Scans a TypeNode (like RequestBody) for symbols and adds them to the import map.
   */
  public collectDependeciesOf(node: ts.TypeNode | undefined) {
    if (!node) return;

    const visit = (n: ts.Node) => {
      console.log("VISITING NODE:", {
        node: n.getText(),
        kind: ts.SyntaxKind[n.kind],
      });
      if (ts.isTypeReferenceNode(n)) {
        const type = this.checker.getTypeFromTypeNode(n);
        // We look for aliasSymbol first (e.g. for types) then getSymbol()
        const symbol = type.aliasSymbol || type.getSymbol();

        if (symbol) {
          const info = this.resolver.getModuleInfo(symbol);
          if (info) {
            this.addImport(info, symbol.getName());
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
  }

  private addImport(
    info: { module: string; isExternal: boolean },
    name: string,
  ) {
    let identifier = info.module;

    if (!info.isExternal) {
      // Calculate relative path from api.index.ts (at shared/src root)
      // to the .d.ts file location
      const relativePath = path
        .relative(this.sharedSrcRoot, info.module)
        .replace(/\.d\.ts$|\.ts$/, "")
        .replace(/\\/g, "/");

      identifier = relativePath.startsWith(".")
        ? relativePath
        : `./${relativePath}`;
    }

    if (!this.importMap.has(identifier)) {
      this.importMap.set(identifier, new Set());
    }
    this.importMap.get(identifier)!.add(name);
  }

  public getImportLines(): string[] {
    const lines: string[] = [];
    for (const [module, symbols] of this.importMap.entries()) {
      const symbolList = Array.from(symbols).sort().join(", ");
      lines.push(`import { ${symbolList} } from "${module}";`);
    }
    return lines.sort();
  }
}
