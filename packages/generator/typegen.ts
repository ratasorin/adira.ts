import ts from "typescript";
import path from "path";
import { DiscoveredRoute } from "./parser";
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
   */
  private typeToString(type: ts.Type, contextNode?: ts.Node): string {
    // 1. Handle Primitives (Keep this first for performance/safety)
    if (type.flags & ts.TypeFlags.String) return "string";
    if (type.flags & ts.TypeFlags.Number) return "number";
    if (type.flags & ts.TypeFlags.Boolean) return "boolean";
    if (type.flags & ts.TypeFlags.Void) return "void";
    if (type.flags & ts.TypeFlags.Undefined) return "undefined";
    if (type.flags & ts.TypeFlags.Null) return "null";
    if (type.flags & ts.TypeFlags.Any) return "any";
    if (type.flags & ts.TypeFlags.Unknown) return "unknown";

    // --- 2. CHECK FOR NAMED TYPES (Moved Up!) ---
    // We check this BEFORE Literals/Unions to ensure we capture the Alias name (e.g. "Status")
    // instead of expanding it immediately.

    const symbol = type.getSymbol() || type.aliasSymbol;

    if (symbol) {
      const name = symbol.getName();

      // Filter out standard library types or internals we don't want to redefine
      // (Unless they are actual Arrays, which we handle specifically later)
      if (name !== "__type" && name !== "Array" && name !== "Promise") {
        const declarations = symbol.getDeclarations();

        // A. Handle External Imports (node_modules)
        if (declarations && declarations.length > 0) {
          const sourceFile = declarations[0].getSourceFile();
          if (sourceFile.fileName.includes("node_modules")) {
            const pkgName = this.getPackageName(sourceFile.fileName);
            if (this.config.allowedDependencies.includes(pkgName)) {
              this.addImport(pkgName, name);

              let args = (type as any).typeArguments as ts.Type[];
              if (
                (!args || args.length === 0) &&
                (type as any).aliasTypeArguments
              ) {
                args = (type as any).aliasTypeArguments as ts.Type[];
              }

              // Recursively visit arguments to ensure their definitions are collected
              if (args && args.length > 0) {
                args.forEach((arg) => this.typeToString(arg));
              }

              return this.printReferenceWithGenerics(symbol, type, name);
            }
            // If external but not allowed, fallback to 'unknown'
            return "unknown";
          }
        }

        // B. Handle Local Definitions
        // If it has a name and isn't an anonymous object literal
        if (!this.isAnonymousObject(type)) {
          // Check recursion stack to prevent infinite loops,
          // but allow the first pass to register the definition
          if (!this.stack.has(type)) {
            this.stack.add(type);
            this.collectDefinition(name, type, symbol);
            this.stack.delete(type);
          }
          return this.printReferenceWithGenerics(symbol, type, name);
        }
      }
    }

    // --- 3. Structural Types (Unions, Literals, Arrays) ---

    // Handle Arrays explicitly (case: string[])
    if (this.checker.isArrayType(type)) {
      // @ts-ignore
      const typeArgs = type.typeArguments || [];
      if (typeArgs.length > 0) {
        return `${this.typeToString(typeArgs[0])}[]`;
      }
      return "any[]";
    }

    // Handle Unions (A | B)
    if (type.isUnion()) {
      return type.types.map((t) => this.typeToString(t)).join(" | ");
    }

    // Handle Intersections (A & B)
    if (type.isIntersection()) {
      return type.types.map((t) => this.typeToString(t)).join(" & ");
    }

    // Handle Literal Types ("hello", 123)
    if (type.isLiteral()) {
      if (type.isStringLiteral()) return `"${type.value}"`;
      if (type.isNumberLiteral()) return `${type.value}`;
      // @ts-ignore
      if (type.intrinsicName === "false") return "false";
      // @ts-ignore
      if (type.intrinsicName === "true") return "true";
    }

    // --- 4. Special Objects ---

    // Handle Promise<T>
    if (symbol && symbol.getName() === "Promise") {
      const typeArgs = (type as any).typeArguments || [];
      if (typeArgs.length > 0) {
        return `Promise<${this.typeToString(typeArgs[0])}>`;
      }
      return "Promise<any>";
    }

    if (this.stack.has(type)) return "any";
    this.stack.add(type);

    try {
      const callSignatures = type.getCallSignatures();
      if (callSignatures.length > 0) {
        // ... (Keep your existing function signature logic)
        const sig = callSignatures[0];
        const params = sig.parameters
          .map((p) => {
            const pType = this.checker.getTypeOfSymbolAtLocation(
              p,
              p.valueDeclaration!,
            );
            const optional = (p.valueDeclaration as ts.ParameterDeclaration)
              ?.questionToken
              ? "?"
              : "";
            return `${p.getName()}${optional}: ${this.typeToString(pType)}`;
          })
          .join(", ");
        const ret = this.typeToString(sig.getReturnType());
        return `(${params}) => ${ret}`;
      }

      const props = type.getProperties();
      if (props.length > 0) {
        // ... (Keep your existing object literal logic)
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
    // 1. Check for standard Class/Interface Generics
    let args = (type as any).typeArguments as ts.Type[];

    // 2. If empty, check for Type Alias Generics (CRITICAL FIX)
    if ((!args || args.length === 0) && (type as any).aliasTypeArguments) {
      args = (type as any).aliasTypeArguments as ts.Type[];
    }

    // 3. Recurse into arguments
    if (args && args.length > 0) {
      const argStrings = args.map((t) => this.typeToString(t));
      return `${name}<${argStrings.join(", ")}>`;
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
    this.definitions.set(name, `// Processing ${name}...`);

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

    let def = "";

    // 1. Unions (A | B)
    if (type.isUnion()) {
      const unionBody = type.types.map((t) => this.typeToString(t)).join(" | ");
      def = `export type ${name}${typeParamsStr} = ${unionBody};`;
    }
    // 2. Intersections (A & B)
    else if (type.isIntersection()) {
      const intersectBody = type.types
        .map((t) => this.typeToString(t))
        .join(" & ");
      def = `export type ${name}${typeParamsStr} = ${intersectBody};`;
    }
    // 3. Literals
    else if (type.isLiteral()) {
      let val = "";
      if (type.isStringLiteral()) val = `"${type.value}"`;
      else if (type.isNumberLiteral()) val = `${type.value}`;
      // @ts-ignore
      else if (type.intrinsicName === "false") val = "false";
      // @ts-ignore
      else if (type.intrinsicName === "true") val = "true";

      def = `export type ${name}${typeParamsStr} = ${val};`;
    }
    // 4. PRIMITIVE GUARDS (Critical Logic)
    // This stops the code from treating 'string' as an object with methods.
    else if (type.flags & ts.TypeFlags.String) {
      def = `export type ${name}${typeParamsStr} = string;`;
    } else if (type.flags & ts.TypeFlags.Number) {
      def = `export type ${name}${typeParamsStr} = number;`;
    } else if (type.flags & ts.TypeFlags.Boolean) {
      def = `export type ${name}${typeParamsStr} = boolean;`;
    } else if (type.flags & ts.TypeFlags.Void) {
      def = `export type ${name}${typeParamsStr} = void;`;
    }
    // 5. Functions
    else if (type.getCallSignatures().length > 0) {
      const sig = type.getCallSignatures()[0];
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
    }
    // 6. Objects / Interfaces
    else {
      const props = type.getProperties();

      const members = props
        .filter((p) => {
          // --- FILTER FIX ---
          // 1. Remove internal/private properties
          if (p.getName().startsWith("__")) return false;

          // 2. Check where this property comes from
          const decls = p.getDeclarations();

          // If no declaration found (synthetic), keep it (safe default)
          if (!decls || decls.length === 0) return true;

          // 3. Check the file source
          const sourceFile = decls[0].getSourceFile();
          const fileName = sourceFile.fileName;

          // If the property is defined in the default TypeScript libraries
          // (like lib.es5.d.ts, which defines Object.prototype, String.prototype, etc.)
          // we exclude it.
          if (fileName.includes("typescript/lib")) return false;
          if (fileName.includes("node_modules/typescript")) return false;

          return true;
        })
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

      const isInterface = declarations?.some((d) =>
        ts.isInterfaceDeclaration(d),
      );

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

export async function generateTypes(
  routes: DiscoveredRoute[],
): Promise<TypesMeta> {
  const result: APITypes = {};

  const program = ts.createProgram({
    rootNames: routes.map((r) => r.handler.path),
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
    const file = program.getSourceFile(route.handler.path);
    if (!file) continue;

    ts.forEachChild(file, (node) => {
      let name: ts.Identifier | undefined;
      let parameters: ts.NodeArray<ts.ParameterDeclaration> | undefined;
      let generics: GenericParam[] = [];

      if (ts.isVariableStatement(node)) {
        const decl = node.declarationList.declarations[0];
        if (
          ts.isVariableDeclaration(decl) &&
          ts.isIdentifier(decl.name) &&
          decl.name.text === route.handler.name &&
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
        node.name?.text === route.handler.name
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
