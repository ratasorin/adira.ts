import ts from "typescript";
import path from "path";
import { RouteMeta } from "./parser";
import { loadConfig } from "./config";
import { AdiraConfig } from "@n/adira.core.ts";

// --- Interfaces (Keep existing) ---
export interface SimpleTypeDefinition {
  RequestParams?: string;
  RequestBody?: string;
  ResponseBody?: string;
  RequestQuery?: string;
  RequestForm?: string;
}
export interface GenericParam {
  name: string;
  constraint?: string;
}
export interface GenericTypeDefinition {
  aliasName: string;
  generics: GenericParam[];
  types: SimpleTypeDefinition;
}
export type MethodTypeDefinition = SimpleTypeDefinition | GenericTypeDefinition;
export interface APITypes {
  [route: string]: { [method: string]: MethodTypeDefinition };
}
export interface TypesMeta {
  api: APITypes;
  imports: string[];
  definitions: string[];
}
export function isGenericTypeDefinition(
  def: MethodTypeDefinition,
): def is GenericTypeDefinition {
  return typeof def === "object" && "aliasName" in def && "generics" in def;
}
export function isSimpleTypeDefinition(
  def: MethodTypeDefinition,
): def is SimpleTypeDefinition {
  return !isGenericTypeDefinition(def);
}

// --- The Semantic Type Walker ---

class TypeCollector {
  private checker: ts.TypeChecker;
  private config: AdiraConfig;

  private definitions = new Map<string, string>();
  private externalImports = new Map<string, Set<string>>();

  // Recursion guard stack
  private stack = new Set<ts.Type>();

  constructor(program: ts.Program) {
    this.checker = program.getTypeChecker();
    this.config = loadConfig();
  }

  /**
   * The entry point. Takes a TypeNode (from AST), gets its Semantic Type,
   * and converts it to a string recursively.
   */
  public resolveTypeNode(node: ts.TypeNode | undefined): string {
    if (!node) return "any";

    // Unwrap Serialize<T, R> -> R logic
    if (
      ts.isTypeReferenceNode(node) &&
      node.typeName.getText().endsWith("Serialize")
    ) {
      if (node.typeArguments && node.typeArguments.length >= 2) {
        return this.resolveTypeNode(node.typeArguments[1]);
      }
    }

    const type = this.checker.getTypeFromTypeNode(node);
    return this.typeToString(type, node);
  }

  /**
   * Recursively converts a TS Type object to a code string.
   * This is "Semantic Expansion" - we look at what the type IS, not what it looks like.
   */
  private typeToString(type: ts.Type, contextNode?: ts.Node): string {
    // 1. Handle Primitives
    if (type.flags & ts.TypeFlags.String) return "string";
    if (type.flags & ts.TypeFlags.Number) return "number";
    if (type.flags & ts.TypeFlags.Boolean) return "boolean";
    if (type.flags & ts.TypeFlags.Void) return "void";
    if (type.flags & ts.TypeFlags.Undefined) return "undefined";
    if (type.flags & ts.TypeFlags.Null) return "null";
    if (type.flags & ts.TypeFlags.Any) return "any";
    if (type.flags & ts.TypeFlags.Unknown) return "unknown";

    // 2. Handle Literal Types ("hello", 123, true)
    if (type.isLiteral()) {
      if (type.isStringLiteral()) return `"${type.value}"`;
      if (type.isNumberLiteral()) return `${type.value}`;
      // @ts-ignore - internal property
      if (type.intrinsicName === "false") return "false";
      // @ts-ignore
      if (type.intrinsicName === "true") return "true";
    }

    // 3. Handle Unions (A | B) and Intersections (A & B)
    if (type.isUnion()) {
      return type.types.map((t) => this.typeToString(t)).join(" | ");
    }
    if (type.isIntersection()) {
      return type.types.map((t) => this.typeToString(t)).join(" & ");
    }

    // 4. Handle Arrays
    if (this.checker.isArrayType(type)) {
      // @ts-ignore - TypeChecker internal helper, or we can look at typeArguments
      const typeArgs = (type as any).typeArguments || [];
      if (typeArgs.length > 0) {
        return `${this.typeToString(typeArgs[0])}[]`;
      }
      return "any[]";
    }

    // --- 5. THE ELEGANT CHECK: External Dependencies ---

    // Get the Symbol associated with this type (Class, Interface, TypeAlias)
    const symbol = type.getSymbol() || type.aliasSymbol;

    if (symbol) {
      const declarations = symbol.getDeclarations();
      if (declarations && declarations.length > 0) {
        const sourceFile = declarations[0].getSourceFile();
        const fileName = sourceFile.fileName;

        // Is it external?
        if (fileName.includes("node_modules")) {
          const pkgName = this.getPackageName(fileName);
          const typeName = symbol.getName();

          // A. Is it Whitelisted? -> IMPORT IT
          if (this.config.allowedDependencies.includes(pkgName)) {
            this.addImport(pkgName, typeName);
            // Handle Generics (e.g. Backend.Response<T>)
            // We need to map the generic arguments of the *reference*, not the expanded type
            return this.printReferenceWithGenerics(symbol, type, typeName);
          }

          // B. Unknown External -> Fail safe to 'any' (or 'object')
          // This prevents the giant expansion of unexpected libraries
          return "any";
        }
      }
    }

    // 6. Handle Objects / Interfaces / Function Signatures
    // Prevent infinite recursion
    if (this.stack.has(type)) {
      // Return the name if it has one, otherwise any
      return symbol ? symbol.getName() : "any";
    }
    this.stack.add(type);

    try {
      // Check if it's a Promise
      if (symbol && symbol.getName() === "Promise") {
        const typeArgs = (type as any).typeArguments || [];
        if (typeArgs.length > 0) {
          return `Promise<${this.typeToString(typeArgs[0])}>`;
        }
        return "Promise<any>";
      }

      // If it has a symbol and name (Local Interface/Class), capture definition and return Name
      // Only do this if it's NOT an anonymous type literal
      if (symbol && !this.isAnonymousObject(type)) {
        const name = symbol.getName();
        // Don't redefine standard lib types (Date, Error, etc) if they slipped through
        if (name !== "__type" && name !== "default") {
          this.collectDefinition(name, type, symbol);

          // Handle Generics for the reference
          return this.printReferenceWithGenerics(symbol, type, name);
        }
      }

      // If we are here, it's either an Anonymous Object Literal OR a Function Signature
      const callSignatures = type.getCallSignatures();
      if (callSignatures.length > 0) {
        const sig = callSignatures[0];
        const params = sig.parameters
          .map((p) => {
            const pType = this.checker.getTypeOfSymbolAtLocation(
              p,
              p.valueDeclaration!,
            );
            const pName = p.getName();
            const optional = (p.valueDeclaration as ts.ParameterDeclaration)
              ?.questionToken
              ? "?"
              : "";
            return `${pName}${optional}: ${this.typeToString(pType)}`;
          })
          .join(", ");
        const ret = this.typeToString(sig.getReturnType());
        return `(${params}) => ${ret}`;
      }

      // It is an object literal structure: { a: string, b: number }
      const props = type.getProperties();
      if (props.length > 0) {
        const members = props.map((prop) => {
          const propType = this.checker.getTypeOfSymbolAtLocation(
            prop,
            prop.valueDeclaration!,
          );
          const optional = (prop.valueDeclaration as ts.PropertyDeclaration)
            ?.questionToken
            ? "?"
            : "";
          return `${prop.getName()}${optional}: ${this.typeToString(propType)}`;
        });
        return `{ ${members.join("; ")} }`;
      }

      return "any";
    } finally {
      this.stack.delete(type);
    }
  }

  // --- Helpers ---

  private printReferenceWithGenerics(
    symbol: ts.Symbol,
    type: ts.Type,
    name: string,
  ): string {
    // If the type has type arguments (it's a generic instance), we need to print them
    // e.g. Backend.Response<User>
    if ((type as any).typeArguments && (type as any).typeArguments.length > 0) {
      const args = ((type as any).typeArguments as ts.Type[]).map((t) =>
        this.typeToString(t),
      );
      return `${name}<${args.join(", ")}>`;
    }
    return name;
  }

  private isAnonymousObject(type: ts.Type): boolean {
    return (
      (type.flags & ts.TypeFlags.Object) !== 0 &&
      (type as ts.ObjectType).objectFlags !== undefined &&
      ((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Anonymous) !== 0
    );
  }

  private collectDefinition(name: string, type: ts.Type, symbol: ts.Symbol) {
    if (this.definitions.has(name)) return;
    this.definitions.set(name, `// Processing ${name}...`); // Placeholder

    // We reconstruct the definition from the Type properties
    // This implicitly "expands" it but using our clean rules

    const isInterface = symbol.declarations?.some((d) =>
      ts.isInterfaceDeclaration(d),
    );

    let def = "";

    // Handle Generic Type Parameters in Definition (e.g. interface Response<T>)
    const declarations = symbol.getDeclarations();
    let typeParamsStr = "";
    if (declarations && declarations.length > 0) {
      const decl = declarations[0] as
        | ts.InterfaceDeclaration
        | ts.TypeAliasDeclaration;
      if (decl.typeParameters) {
        typeParamsStr = `<${decl.typeParameters.map((tp) => tp.name.getText()).join(", ")}>`;
      }
    }

    // Check for Call Signatures (Functional Interfaces)
    const callSigs = type.getCallSignatures();
    if (callSigs.length > 0 && !isInterface) {
      // It's likely a type alias for a function
      const sig = callSigs[0];
      const params = sig.parameters
        .map((p) => {
          const pt = this.checker.getTypeOfSymbolAtLocation(
            p,
            p.valueDeclaration!,
          );
          return `${p.getName()}: ${this.typeToString(pt)}`;
        })
        .join(", ");
      const ret = this.typeToString(sig.getReturnType());
      def = `export type ${name}${typeParamsStr} = (${params}) => ${ret};`;
    } else {
      // Object / Interface
      const props = type.getProperties();
      const members = props
        .map((p) => {
          const pt = this.checker.getTypeOfSymbolAtLocation(
            p,
            p.valueDeclaration!,
          );
          const optional = (p.valueDeclaration as any)?.questionToken
            ? "?"
            : "";
          return `  ${p.getName()}${optional}: ${this.typeToString(pt)};`;
        })
        .join("\n");

      if (isInterface) {
        def = `export interface ${name}${typeParamsStr} {\n${members}\n}`;
      } else {
        def = `export type ${name}${typeParamsStr} = {\n${members}\n};`;
      }
    }

    this.definitions.set(name, def);
  }

  private getPackageName(pathStr: string): string {
    const parts = pathStr.split("node_modules" + path.sep);
    if (parts.length > 1) {
      const pkgParts = parts[parts.length - 1].split(path.sep);
      const names = pkgParts.filter((p) => p !== "");
      if (names[0].startsWith("@") && names.length > 1) {
        return `${names[0]}/${names[1]}`;
      }
      return names[0];
    }
    return "";
  }

  private addImport(pkgName: string, typeName: string) {
    if (!this.externalImports.has(pkgName)) {
      this.externalImports.set(pkgName, new Set());
    }
    // Clean up "Backend.Response" -> "Backend"
    const root = typeName.split(".")[0];
    this.externalImports.get(pkgName)!.add(root);
  }

  public getImports(): string[] {
    const lines: string[] = [];
    for (const [pkg, types] of this.externalImports) {
      lines.push(`import { ${Array.from(types).join(", ")} } from "${pkg}";`);
    }
    return lines;
  }

  public getDefinitions(): string[] {
    return Array.from(this.definitions.values());
  }
}

// --- Main Generator ---

export async function generateTypes(routes: RouteMeta[]): Promise<TypesMeta> {
  const result: APITypes = {};

  const program = ts.createProgram({
    rootNames: routes.map((r) => r.handlerPath),
    options: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.CommonJS,
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: false,
    },
  });

  const collector = new TypeCollector(program);

  for (const route of routes) {
    const file = program.getSourceFile(route.handlerPath);
    if (!file) continue;

    ts.forEachChild(file, (node) => {
      let name: ts.Identifier | undefined;
      let parameters: ts.NodeArray<ts.ParameterDeclaration> | undefined;
      let generics: GenericParam[] = [];

      // ... (Keep existing parser logic for VariableStatement and FunctionDeclaration) ...
      // [Copy lines 284-315 from previous code, identical logic]
      if (ts.isVariableStatement(node)) {
        const decl = node.declarationList.declarations[0];
        if (
          ts.isVariableDeclaration(decl) &&
          ts.isIdentifier(decl.name) &&
          decl.name.text === route.handlerName &&
          decl.initializer
        ) {
          name = decl.name;
          // @ts-ignore
          parameters = decl.initializer.parameters;
          // @ts-ignore
          if (decl.initializer.typeParameters) {
            // @ts-ignore
            decl.initializer.typeParameters.forEach((tp) =>
              generics.push({
                name: tp.name.getText(),
                constraint: tp.constraint?.getText(),
              }),
            );
          }
        }
      } else if (
        ts.isFunctionDeclaration(node) &&
        node.name?.text === route.handlerName
      ) {
        name = node.name;
        parameters = node.parameters;
        if (node.typeParameters) {
          node.typeParameters.forEach((tp) =>
            generics.push({
              name: tp.name.getText(),
              constraint: tp.constraint?.getText(),
            }),
          );
        }
      }

      if (name && parameters) {
        const reqType = parameters[0]?.type;
        const resType = parameters[1]?.type;

        const paramsDict = extractTypeGeneric(reqType, 0);
        const body = extractTypeGeneric(reqType, 2);
        const query = extractTypeGeneric(reqType, 3);
        const res = extractTypeGeneric(resType, 0);

        // Use resolveTypeNode instead of visitNode
        const bodyStr = collector.resolveTypeNode(body);
        const queryStr = collector.resolveTypeNode(query);
        const paramsStr = collector.resolveTypeNode(paramsDict);
        const resStr = collector.resolveTypeNode(res);

        const key = path.join(route.prefix || "", route.path || "");
        const methodKey = route.method.toUpperCase();

        if (!result[key]) result[key] = {};
        const defObject = {
          RequestParams: paramsStr,
          RequestBody: bodyStr,
          ResponseBody: resStr,
          RequestQuery: queryStr,
        };

        if (generics.length > 0) {
          result[key][methodKey] = {
            aliasName: key.concat(methodKey).replace(/[^a-zA-Z0-9]/g, "_"),
            generics,
            types: defObject,
          };
        } else {
          result[key][methodKey] = defObject;
        }
      }
    });
  }

  return {
    api: result,
    imports: collector.getImports(),
    definitions: collector.getDefinitions(),
  };
}

function extractTypeGeneric(
  node: ts.TypeNode | undefined,
  index: number,
): ts.TypeNode | undefined {
  if (
    node &&
    ts.isTypeReferenceNode(node) &&
    node.typeArguments &&
    node.typeArguments.length > index
  ) {
    return node.typeArguments[index];
  }
  return undefined;
}
