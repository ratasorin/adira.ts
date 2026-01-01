import ts from "typescript";
import { DependencyResolver } from "../utils";

export class SymbolCollector {
  private checker: ts.TypeChecker;
  private keepSet: Set<ts.Symbol> = new Set();

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
    if (this.keepSet.has(rootSymbol)) return;

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
      this.exploreDeclaration(decl);
    });
  }

  /**
   * Inspects the "Box" a type lives in (Heritage, Signatures, etc.)
   */
  private exploreDeclaration(decl: ts.Declaration) {
    // 1. Heritage Clauses (extends/implements) - CRITICAL
    if (ts.isInterfaceDeclaration(decl) || ts.isClassDeclaration(decl)) {
      decl.heritageClauses?.forEach((clause) => {
        clause.types.forEach((t) => {
          const s = this.checker.getSymbolAtLocation(t.expression);
          if (s) this.crawl(s);
          t.typeArguments?.forEach((arg) => this.crawlTypeNode(arg));
        });
      });
    }

    // 2. Type Nodes (Standard definitions)
    const typeNode = (decl as any).type as ts.TypeNode | undefined;
    if (typeNode) {
      this.crawlTypeNode(typeNode);
    }

    // 3. Functional Members (Parameters & Returns)
    if (ts.isFunctionLike(decl)) {
      decl.parameters.forEach((p) => this.crawlTypeNode(p.type));
      this.crawlTypeNode(decl.type);
      decl.typeParameters?.forEach((tp) => {
        this.crawlTypeNode(tp.constraint);
        this.crawlTypeNode(tp.default);
      });
    }

    // 4. Structure for Interfaces/Object Literals
    // Note: We avoid Namespaces/Modules here to keep the climb "passive"
    if (ts.isInterfaceDeclaration(decl) || ts.isTypeLiteralNode(decl)) {
      decl.members.forEach((member) => {
        // 1. Properties (name: Type)
        if (ts.isPropertySignature(member)) {
          this.crawlTypeNode(member.type);
        }
        // 2. Methods (name(): Type)
        else if (ts.isMethodSignature(member)) {
          this.crawlTypeNode(member.type);
          member.parameters.forEach((p) => this.crawlTypeNode(p.type));
        }
        // 3. Call Signatures ( (): Type )
        else if (
          ts.isCallSignatureDeclaration(member) ||
          ts.isConstructSignatureDeclaration(member)
        ) {
          this.crawlTypeNode(member.type);
          member.parameters.forEach((p) => this.crawlTypeNode(p.type));
        }
        // 4. Index Signatures ( [key: string]: Type )
        else if (ts.isIndexSignatureDeclaration(member)) {
          this.crawlTypeNode(member.type);
        }
      });
    }
  }

  /**
   * Recursively walks the TypeNode AST.
   */
  private crawlTypeNode(
    node: ts.Node | undefined,
    onSymbol?: (symbol: ts.Symbol) => void,
  ) {
    if (!node) return;

    // Type References (User, API.Response)
    if (ts.isTypeReferenceNode(node)) {
      // 1. Resolve the leaf (i.e. Response)
      const symbol = this.checker.getSymbolAtLocation(node.typeName);
      if (symbol) {
        if (onSymbol) {
          onSymbol(symbol);
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
              onSymbol(qualifierSymbol);
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
          onSymbol(symbol);
        } else this.crawl(symbol);
      }
    }
    // Inline Import Types (import('./x').Y)
    else if (ts.isImportTypeNode(node)) {
      const symbol = this.checker.getSymbolAtLocation(node.qualifier || node);
      if (symbol) {
        if (onSymbol) {
          onSymbol(symbol);
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
        if (ts.isTypeNode(child)) this.crawlTypeNode(child, onSymbol);
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
   * Scans a TypeNode and collects all referenced symbols within it.
   * Does NOT crawl into those symbols' definitions.
   * Used for generating imports.
   */
  public collectRootReferences(node: ts.Node): Set<ts.Symbol> {
    const refs = new Set<ts.Symbol>();

    this.crawlTypeNode(node, (symbol) => {
      const resolved = this.resolveSymbol(symbol);
      // Optional: Resolve aliases if you want the underlying type,
      // or keep the alias if you want to import the alias.
      // Usually for imports, we want the symbol as it appears in the code.
      refs.add(resolved);
    });

    return refs;
  }
}
