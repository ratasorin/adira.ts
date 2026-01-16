import ts from "typescript";
import { DependencyResolver } from "src/utils/dependency-resolver";

export class SymbolCollector {
  private checker: ts.TypeChecker;
  private keepSet: Set<ts.Symbol> = new Set();
  private processedSymbols: Set<ts.Symbol> = new Set();

  public collectedSymbols() {
    return this.keepSet;
  }

  constructor(
    private program: ts.Program,
    private resolver: DependencyResolver,
  ) {
    this.checker = program.getTypeChecker();
  }

  /**
   * Helper: unwraps imports/exports to find the original source definition.
   * e.g. import { X } from './b' -> resolves to X in './b'
   */
  private resolveSymbol(symbol: ts.Symbol): ts.Symbol {
    let current = symbol;
    // Walk the chain of aliases until we hit the bedrock definition
    while (current.flags & ts.SymbolFlags.Alias) {
      const next = this.checker.getAliasedSymbol(current);
      if (!next || next === current) break;
      current = next;
    }
    return current;
  }

  /**
   * Primary entry point for a Symbol.
   * Handles Alias resolution, Border Patrol, and Vertical Passive climbing.
   */
  public crawl(symbol: ts.Symbol) {
    if (this.processedSymbols.has(symbol)) return;
    this.processedSymbols.add(symbol);

    // 1. Resolve the chain to find the actual definition (rootSymbol)
    const chain: ts.Symbol[] = [];
    let rootSymbol = symbol;

    while (rootSymbol.flags & ts.SymbolFlags.Alias) {
      chain.push(rootSymbol);
      const nextSymbol = this.checker.getImmediateAliasedSymbol(rootSymbol);
      if (!nextSymbol || nextSymbol === rootSymbol) break;
      rootSymbol = nextSymbol;
    }

    // 2. Already processed?

    // 3. BORDER PATROL: Check the root definition
    const info = this.resolver.getModuleInfo(rootSymbol);
    if (!info) return; // Blacklisted: Stop everything.

    const isFile =
      !!(rootSymbol.flags & ts.SymbolFlags.Module) &&
      !(rootSymbol.flags & ts.SymbolFlags.Alias);

    // Do not add modules (files) as symbols
    // This happens an entire file is aliased: import * as Lib from 'libs'
    if (!isFile) {
      this.keepSet.add(rootSymbol);
    }

    for (const alias of chain) {
      this.keepSet.add(alias);
    }

    // 5. Vertical climb
    this.passiveClimbToParent(rootSymbol);

    if (info.isExternal) return;

    // 6. AST Exploration
    // We crawl ALL declarations to handle (potential) file
    rootSymbol.declarations?.forEach((decl) => {
      this.crawlTypeNode(decl);
    });
  }

  /**
   * Recursively walks the TypeNode AST.
   */
  private crawlTypeNode(
    node: ts.Node | undefined,
    onSymbol?: (symbol: ts.Symbol, location: ts.Node) => void,
  ) {
    if (!node) return;
    // Type References (User, API.Response)
    if (ts.isTypeReferenceNode(node)) {
      // 1. Resolve the leaf (i.e. Response)
      const symbol = this.checker.getSymbolAtLocation(node.typeName);
      if (symbol) {
        if (onSymbol) {
          onSymbol(symbol, node.typeName);
        } else this.crawl(symbol);
      }

      // 2. Resolve the Qualifier (i.e. API)
      let entityName = node.typeName;
      while (ts.isQualifiedName(entityName)) {
        const qualifierSymbol = this.checker.getSymbolAtLocation(
          entityName.left,
        );

        if (qualifierSymbol) {
          // CHECK: Is this just the file/module?
          // If it's a Namespace Import Alias, it will have Alias flags.
          // If it's the raw Module, we stop.
          const isRawModule =
            qualifierSymbol.flags &
            (ts.SymbolFlags.Module | ts.SymbolFlags.ValueModule);
          const isAlias = qualifierSymbol.flags & ts.SymbolFlags.Alias;

          if (isAlias && !isRawModule) {
            if (onSymbol) {
              onSymbol(qualifierSymbol, entityName.left);
            } else this.crawl(qualifierSymbol);
          }
        }
        entityName = entityName.left;
      }
      node.typeArguments?.forEach((arg) => this.crawlTypeNode(arg, onSymbol));
    }
    // typeof References
    else if (ts.isTypeQueryNode(node)) {
      const symbol = this.checker.getSymbolAtLocation(node.exprName);
      if (symbol) {
        if (onSymbol) {
          onSymbol(symbol, node.exprName);
        } else this.crawl(symbol);
      }

      let entityName = node.exprName;
      while (ts.isQualifiedName(entityName)) {
        const qualifierSymbol = this.checker.getSymbolAtLocation(
          entityName.left,
        );
        if (qualifierSymbol) {
          if (onSymbol) {
            onSymbol(qualifierSymbol, entityName.left);
          } else {
            // Same check as above for recursion safety
            const isRawModule =
              qualifierSymbol.flags &
              (ts.SymbolFlags.Module | ts.SymbolFlags.ValueModule);
            const isAlias = qualifierSymbol.flags & ts.SymbolFlags.Alias;
            if (isAlias && !isRawModule) this.crawl(qualifierSymbol);
          }
        }
        entityName = entityName.left;
      }
    }
    // Inline Import Types (import('./x').Y)
    else if (ts.isImportTypeNode(node)) {
      const symbol = this.checker.getSymbolAtLocation(node.qualifier || node);
      if (symbol) {
        if (onSymbol) {
          onSymbol(symbol, node.qualifier || node);
        } else this.crawl(symbol);
      }
      node.typeArguments?.forEach((arg) => this.crawlTypeNode(arg, onSymbol));
    }
    // Conditional Branches (T extends U ? A : B) - Keeps BOTH
    else if (ts.isConditionalTypeNode(node)) {
      this.crawlTypeNode(node.checkType, onSymbol);
      this.crawlTypeNode(node.extendsType, onSymbol);
      this.crawlTypeNode(node.trueType, onSymbol);
      this.crawlTypeNode(node.falseType, onSymbol);
    }
    // Logical Composition (A | B, A & B)
    else if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
      node.types.forEach((t) => this.crawlTypeNode(t, onSymbol));
    }
    // Mapped Types
    else if (ts.isMappedTypeNode(node)) {
      this.crawlTypeNode(node.typeParameter.constraint, onSymbol);
      this.crawlTypeNode(node.nameType, onSymbol);
      this.crawlTypeNode(node.type, onSymbol);
    }
    // General Fallback (Arrays, Tuples, Parentheses)
    else {
      ts.forEachChild(node, (child) => {
        this.crawlTypeNode(child, onSymbol);
      });
    }
  }

  private passiveClimbToParent(symbol: ts.Symbol) {
    const ContainerFlags =
      ts.SymbolFlags.NamespaceModule |
      ts.SymbolFlags.Class |
      ts.SymbolFlags.RegularEnum;

    let parent = (symbol as any).parent as ts.Symbol | undefined;
    while (parent) {
      if (this.keepSet.has(parent)) break;
      if (parent.flags & ContainerFlags) {
        this.keepSet.add(parent);
      }
      parent = (parent as any).parent;
    }
  }

  public collectFromSymbols(symbols: Set<ts.Symbol>): Set<ts.Symbol> {
    for (const symbol of symbols) {
      this.crawl(symbol);
    }
    return this.keepSet;
  }

  /**
   * Entry point for collecting symbols from an anonymous TypeNode
   * (e.g., the return type of a function, or a generic parameter).
   * * Note: This does NOT collect the node itself (it's not a symbol),
   * but it collects all symbols referenced within that node.
   */
  public collectFromNodes(nodes: Set<ts.TypeNode>): Set<ts.Symbol> {
    nodes.forEach((node) => this.crawlTypeNode(node));
    return this.keepSet;
  }

  /**
   * Returns true if the symbol is a member of a Namespace, Class, or Enum.
   * Returns false if the symbol is a top-level file export.
   */
  private isNestedSymbol(symbol: ts.Symbol): boolean {
    const parent = (symbol as any).parent as ts.Symbol | undefined;

    if (!parent) return false; // No parent (e.g. globals) -> Not nested

    // If the parent has declarations, we can check if it's a File or a Module/Class
    if (parent.declarations && parent.declarations.length > 0) {
      const parentDecl = parent.declarations[0];

      // If parent is a SourceFile, then our symbol is Top-Level. -> Keep it.
      if (ts.isSourceFile(parentDecl)) {
        return false;
      }

      // If parent is a Module (Namespace), Class, or Enum -> Our symbol is Nested. -> Skip it.
      if (
        ts.isModuleDeclaration(parentDecl) ||
        ts.isClassDeclaration(parentDecl) ||
        ts.isEnumDeclaration(parentDecl)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Scans a TypeNode and collects all referenced symbols within it.
   * Does NOT crawl into those symbols' definitions.
   * Used for generating imports.
   */
  public collectRootReferences(node: ts.Node): Set<ts.Symbol> {
    const refs = new Set<ts.Symbol>();

    this.crawlTypeNode(node, (symbol, location) => {
      // If the location is a QualifiedName (e.g. "Backend.Infer"),
      // 'symbol' corresponds to "Infer".
      // We ignore "Infer" because we know "Backend" (the left side)
      // will be visited separately by the walker.
      if (ts.isQualifiedName(location)) {
        return;
      }
      const resolved = this.resolveSymbol(symbol);
      if (this.isNestedSymbol(resolved)) return;

      // Add the origianl symbol to preserve aliasing
      refs.add(symbol);
    });

    return refs;
  }
}
