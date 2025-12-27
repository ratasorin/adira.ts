import ts from "typescript";
import { DependencyResolver } from "../utils";

export class SymbolCollector {
  private checker: ts.TypeChecker;
  private keepSet: Set<ts.Symbol> = new Set();
  private visitedTypes: Set<ts.Type> = new Set();

  constructor(
    private program: ts.Program,
    private resolver: DependencyResolver,
  ) {
    this.checker = program.getTypeChecker();
  }

  public crawl(symbol: ts.Symbol) {
    // 1. HORIZONTAL RESOLUTION (Alias Chaining)
    // We walk the chain and keep every intermediate symbol (imports/exports)
    // so the Pruner doesn't nuke the "path" to the definition.
    let currentSymbol = symbol;
    while (currentSymbol.flags & ts.SymbolFlags.Alias) {
      this.keepSet.add(currentSymbol);
      const nextSymbol = this.checker.getAliasedSymbol(currentSymbol);
      if (!nextSymbol || nextSymbol === currentSymbol) break;
      currentSymbol = nextSymbol;
    }

    const rootSymbol = currentSymbol;
    if (this.keepSet.has(rootSymbol)) return;

    // 2. BORDER PATROL
    const info = this.resolver.getModuleInfo(rootSymbol);
    if (!info) return; // Blacklisted external - do not add to keepSet

    this.keepSet.add(rootSymbol);

    // 3. VERTICAL RESOLUTION (Passive Parent Climb)
    // Ensures QualifiedNames (Namespace.Type) or Enums (Enum.Member) stay valid.
    this.passiveClimbToParent(rootSymbol);

    // 4. EXTERNAL BOUNDARY
    if (info.isExternal) {
      // Whitelisted external (e.g. @refs/land): we keep the symbol
      // but STOP the deep recursive crawl.
      return;
    }

    // 5. DEEP RESOLUTION (Local Structure)
    const type = this.checker.getDeclaredTypeOfSymbol(rootSymbol);
    this.crawlStructure(type);
  }

  /**
   * Vertical Climb: Adds parent containers to the set without crawling them.
   */
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

  /**
   * Crawl Structure: Explores all properties and members of a local type.
   */
  private crawlStructure(type: ts.Type) {
    // 1. Cycle detection: Prevent infinite loops
    if (this.visitedTypes.has(type)) return;
    this.visitedTypes.add(type);

    const s = type.getSymbol() || type.aliasSymbol;

    // Don't "crawlStructure" of types from external modules, but do register them (as they are probably used!)
    if (s) {
      const info = this.resolver.getModuleInfo(s);
      if (info && info.isExternal) {
        this.crawl(s);
        return;
      }
    }

    // 2. Generics (Type Arguments) - early because we must grab this before we discard the "Envelope" (Std Lib Type) to prevent recursing into "string", "push", "pop", etc.
    // e.g. Array<User>, Promise<T>
    if ((type as ts.TypeReference).typeArguments) {
      (type as ts.TypeReference).typeArguments?.forEach((arg) =>
        this.crawlStructure(arg),
      );
    }

    // 3. The Barrier (Discard the Envelope)
    // If it is Array, Promise, Map, etc., we stop here.
    // We don't want to crawl 'push', 'pop', 'length'.
    if (this.isStandardLibraryOrPrimitive(type)) {
      return;
    }

    // 4. Check for symbols (The "Side Effect")
    // If this structure happens to have a name (e.g. 'User'), registers it.
    if (s) {
      const isMember =
        s.flags &
        (ts.SymbolFlags.Method |
          ts.SymbolFlags.Property |
          ts.SymbolFlags.Accessor);

      // We register the symbol of the type we are currently looking at.
      // BUT we must filter out "Members" (properties/methods) because they are
      // owned by their parent (API) and shouldn't appear in the top-level keepSet.
      if (!isMember) {
        this.crawl(s);
      }
    }

    if ((type as ts.TypeReference).typeArguments) {
      (type as ts.TypeReference).typeArguments?.forEach((arg) => {
        this.crawlStructure(arg);
      });
    }

    // 5. Signatures (Call/Construct)
    // e.g. (x: Input) => Output, or new (x: Config) => App

    this.crawlSignatures(type);

    // 6. Properties (Named Keys)
    // e.g. { name: string, process: (i: Input) => Output }
    type.getProperties().forEach((prop) => {
      const decl = prop.valueDeclaration || prop.declarations?.[0];
      if (decl) {
        const propType = this.checker.getTypeOfSymbolAtLocation(prop, decl);
        this.crawlStructure(propType);
      }
    });

    // 7. Index Signatures
    // e.g. { [id: string]: User }
    const indexInfos = this.checker.getIndexInfosOfType(type);
    indexInfos.forEach((info) => {
      this.crawlStructure(info.type);
    });

    // 8. Heritage (Base Types)
    // e.g. interface User extends Base
    if (type.isClassOrInterface()) {
      this.checker.getBaseTypes(type).forEach((base) => {
        this.crawlStructure(base);
      });
    }

    // 9. Unions / Intersections
    // e.g. User | Admin, User & Identifiable
    if (type.isUnionOrIntersection()) {
      type.types.forEach((subType) => {
        this.crawlStructure(subType);
      });
    }

    // 10. TypeOf (Value Modules)
    const typeQuerySymbol = type.getSymbol();
    if (typeQuerySymbol && typeQuerySymbol.flags & ts.SymbolFlags.ValueModule) {
      this.crawl(typeQuerySymbol);
    }
  }

  private crawlTypeArguments(type: ts.Type) {
    const typeRef = type as ts.TypeReference;
    if (typeRef.typeArguments) {
      typeRef.typeArguments.forEach((arg) => {
        const s = arg.getSymbol() || arg.aliasSymbol;
        if (s) this.crawl(s);
      });
    }
  }

  /**
   * Helper: Returns true for Primitives (string, number) AND
   * types defined in the default library (Array, Map, Promise).
   */
  private isStandardLibraryOrPrimitive(type: ts.Type): boolean {
    // 1. Check Primitives & Literals (string, 42, true, etc)
    if (
      type.flags &
      (ts.TypeFlags.String |
        ts.TypeFlags.Number |
        ts.TypeFlags.Boolean |
        ts.TypeFlags.Void |
        ts.TypeFlags.Undefined |
        ts.TypeFlags.Null |
        ts.TypeFlags.Never |
        ts.TypeFlags.Any)
    ) {
      return true;
    }
    if (type.isLiteral()) return true;

    // 2. Check Definition Source (Array, Promise, etc)
    const symbol = type.getSymbol();
    if (!symbol) return false;

    // If a type has no declarations (rare), assume safe to crawl or ignore.
    const decls = symbol.getDeclarations();
    if (!decls || decls.length === 0) return false;

    // Check if the file is a default library (lib.d.ts)
    return this.program.isSourceFileDefaultLibrary(decls[0].getSourceFile());
  }

  private crawlSignatures(type: ts.Type) {
    const signatures = [
      ...this.checker.getSignaturesOfType(type, ts.SignatureKind.Call),
      ...this.checker.getSignaturesOfType(type, ts.SignatureKind.Construct),
    ];

    for (const sig of signatures) {
      const retType = sig.getReturnType();
      const retSym = retType.getSymbol() || retType.aliasSymbol;
      if (retSym) this.crawl(retSym);
      this.crawlTypeArguments(retType);

      sig.getParameters().forEach((param) => {
        const pDecl = param.valueDeclaration || param.declarations?.[0];
        if (pDecl) {
          const pType = this.checker.getTypeOfSymbolAtLocation(param, pDecl);
          const pSym = pType.getSymbol() || pType.aliasSymbol;
          if (pSym) this.crawl(pSym);
          this.crawlTypeArguments(pType);
          // Recurse: parameters can be callbacks! fn(cb: (x: X) => void)
          this.crawlSignatures(pType);
        }
      });
    }
  }

  /**
   * Public Ignition Method
   */
  public collect(whitelistedTypeNames: string[]): Set<ts.Symbol> {
    for (const sourceFile of this.program.getSourceFiles()) {
      if (this.program.isSourceFileFromExternalLibrary(sourceFile)) continue;

      ts.forEachChild(sourceFile, (node) => {
        if (
          (ts.isInterfaceDeclaration(node) ||
            ts.isClassDeclaration(node) ||
            ts.isTypeAliasDeclaration(node) ||
            ts.isEnumDeclaration(node) ||
            ts.isVariableDeclaration(node) ||
            ts.isFunctionDeclaration(node)) &&
          node.name &&
          whitelistedTypeNames.includes(node.name.getText())
        ) {
          const symbol = this.checker.getSymbolAtLocation(node.name);
          if (symbol) this.crawl(symbol);
        }
      });
    }
    return this.keepSet;
  }
}
