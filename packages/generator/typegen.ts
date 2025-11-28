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

class TypeCollector {
  private checker: ts.TypeChecker;
  private config: AdiraConfig;

  private definitions = new Map<string, string>();
  private externalImports = new Map<string, Set<string>>();

  // Prevents infinite recursion (e.g. User -> Order -> User)
  private processingStack = new Set<string>();

  constructor(program: ts.Program) {
    this.checker = program.getTypeChecker();
    this.config = loadConfig();

    console.log({ config: this.config });
  }

  /**
   * PURE SYNTACTIC RESOLVER
   * Uses AST Node Kinds only. No checker.getTypeFromTypeNode().
   */
  public resolveTypeNode(node: ts.TypeNode | undefined): string {
    if (!node) return "unknown";

    switch (node.kind) {
      // 1. Primitives
      case ts.SyntaxKind.StringKeyword:
        return "string";
      case ts.SyntaxKind.NumberKeyword:
        return "number";
      case ts.SyntaxKind.BooleanKeyword:
        return "boolean";
      case ts.SyntaxKind.VoidKeyword:
        return "void";
      case ts.SyntaxKind.UndefinedKeyword:
        return "undefined";
      case ts.SyntaxKind.NullKeyword:
        return "null";
      case ts.SyntaxKind.AnyKeyword:
        return "any";
      case ts.SyntaxKind.UnknownKeyword:
        return "unknown";
      case ts.SyntaxKind.NeverKeyword:
        return "never";
      case ts.SyntaxKind.ObjectKeyword:
        return "object";

      // 2. Arrays (Recursive)
      case ts.SyntaxKind.ArrayType: {
        const arr = node as ts.ArrayTypeNode;
        return `${this.resolveTypeNode(arr.elementType)}[]`;
      }

      // 3. Unions (Recursive)
      case ts.SyntaxKind.UnionType: {
        const union = node as ts.UnionTypeNode;
        const members = union.types.map((t) => this.resolveTypeNode(t));
        return members.join(" | ");
      }

      // 4. Intersections (Recursive)
      case ts.SyntaxKind.IntersectionType: {
        const intersect = node as ts.IntersectionTypeNode;
        const members = intersect.types.map((t) => this.resolveTypeNode(t));
        return members.join(" & ");
      }

      // 5. References (The Core Logic)
      case ts.SyntaxKind.TypeReference: {
        return this.handleTypeReference(node as ts.TypeReferenceNode);
      }

      // 6. Inline Object Literals { a: string }
      case ts.SyntaxKind.TypeLiteral: {
        return this.handleTypeLiteral(node as ts.TypeLiteralNode);
      }

      // 7. Literals ("hello", 123)
      case ts.SyntaxKind.LiteralType: {
        const lit = node as ts.LiteralTypeNode;
        // @ts-ignore
        if (lit.literal.text) return `"${lit.literal.text}"`;
        // @ts-ignore
        return lit.literal.text || "unknown";
      }

      default:
        return "unknown";
    }
  }

  private handleTypeReference(node: ts.TypeReferenceNode): string {
    const rawName = this.getEntityName(node.typeName);
    const nameParts = rawName.split(".");
    const simpleName = nameParts[nameParts.length - 1];

    // --- RULE 0: DATES -> STRING ---
    // JSON APIs serialize Dates as ISO strings.
    // We catch this Syntactically before looking up definitions.
    if (simpleName === "Date") {
      return "string";
    }

    // --- RULE 1: HANDLE `Serialize` ONLY ---
    if (simpleName === "Serialize") {
      if (node.typeArguments && node.typeArguments.length >= 2) {
        return this.resolveTypeNode(node.typeArguments[1]);
      }
      return "unknown";
    }

    // --- RULE 2: RESOLVE ARGUMENTS FIRST ---
    // We resolve these immediately so we have the string ready (e.g. "<ICategory>")
    const generics = node.typeArguments
      ? `<${node.typeArguments.map((arg) => this.resolveTypeNode(arg)).join(", ")}>`
      : "";

    // --- RULE 3: RESOLVE SYMBOL & FOLLOW ALIASES (THE FIX) ---
    let symbol = this.checker.getSymbolAtLocation(node.typeName);

    if (symbol) {
      // CRITICAL FIX: If this symbol is just an import (Alias), follow it to the real definition
      if (symbol.flags & ts.SymbolFlags.Alias) {
        symbol = this.checker.getAliasedSymbol(symbol);
      }
    }

    if (!symbol) {
      // It's likely a Generic Parameter (T) or global that TS can't resolve contextually
      return rawName + generics;
    }

    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) return "unknown";

    const declaration = declarations[0];
    const sourceFile = declaration.getSourceFile();
    console.log({ sourceFile });
    const isNodeModule = sourceFile.fileName.includes("node_modules");

    // A. External Imports (e.g. Backend.ExecuteGET)
    if (isNodeModule) {
      const pkgName = this.getPackageName(sourceFile.fileName);
      if (this.config.allowedDependencies.includes(pkgName)) {
        const rootName = nameParts[0];
        this.addImport(pkgName, rootName);
        return rawName + generics;
      }
      return "unknown";
    }

    // B. Local Definitions
    // Now that we followed the alias, `declaration` is the actual Interface/Type/Enum
    if (
      ts.isInterfaceDeclaration(declaration) ||
      ts.isTypeAliasDeclaration(declaration) ||
      ts.isEnumDeclaration(declaration) ||
      ts.isClassDeclaration(declaration)
    ) {
      // We queue the definition using the simple name (e.g. "ICategory")
      this.queueDefinition(simpleName, declaration);
      return simpleName + generics;
    }

    return "unknown";
  }

  private handleTypeLiteral(node: ts.TypeLiteralNode): string {
    const members = node.members
      .map((m) => this.printMember(m))
      .filter((m) => m !== "")
      .join("\n");
    return `{\n${members}\n}`;
  }

  // --- DEFINITION GENERATION ---

  private queueDefinition(name: string, declaration: ts.Declaration) {
    if (this.definitions.has(name) || this.processingStack.has(name)) return;
    this.processingStack.add(name);

    // Placeholder to handle circular refs during recursion
    this.definitions.set(name, `// Processing ${name}...`);

    let defString = "";

    try {
      if (ts.isInterfaceDeclaration(declaration)) {
        // interface IUser { ... }
        const members = declaration.members
          .map((m) => this.printMember(m))
          .join("\n");

        let extendsClause = "";
        if (declaration.heritageClauses) {
          const extendsTypes = declaration.heritageClauses[0].types.map(
            // @ts-expect-error bleh
            (t) => this.handleTypeReference(t), // Reuse reference handler for 'extends'
          );
          if (extendsTypes.length > 0) {
            extendsClause = ` extends ${extendsTypes.join(", ")}`;
          }
        }

        const params = this.printTypeParams(declaration.typeParameters);
        defString = `export interface ${name}${params}${extendsClause} {\n${members}\n}`;
      } else if (ts.isTypeAliasDeclaration(declaration)) {
        // type X = ...
        // We MUST resolve the TypeNode of the alias to capture dependencies
        const targetType = this.resolveTypeNode(declaration.type);
        const params = this.printTypeParams(declaration.typeParameters);
        defString = `export type ${name}${params} = ${targetType};`;
      } else if (ts.isEnumDeclaration(declaration)) {
        const members = declaration.members
          .map((m) => {
            const val = m.initializer ? ` = ${m.initializer.getText()}` : "";
            return `  ${m.name.getText()}${val},`;
          })
          .join("\n");
        defString = `export enum ${name} {\n${members}\n}`;
      }
    } catch (e) {
      console.error(`Failed to generate definition for ${name}`, e);
      defString = `export type ${name} = any; // Error`;
    }

    this.definitions.set(name, defString);
    this.processingStack.delete(name);
  }

  private printMember(member: ts.TypeElement): string {
    if (ts.isPropertySignature(member)) {
      // Exclude internals
      if (member.name.getText().startsWith("__")) return "";

      const pName = member.name.getText();
      const optional = member.questionToken ? "?" : "";
      // Recursively resolve the property type
      const typeStr = this.resolveTypeNode(member.type);

      return `  ${pName}${optional}: ${typeStr};`;
    }
    return "";
  }

  // --- HELPERS ---

  private getEntityName(name: ts.EntityName): string {
    if (ts.isIdentifier(name)) {
      return name.text;
    }
    return `${this.getEntityName(name.left)}.${name.right.text}`;
  }

  private printTypeParams(
    params?: ts.NodeArray<ts.TypeParameterDeclaration>,
  ): string {
    if (!params || params.length === 0) return "";
    const inner = params
      .map((p) => {
        const constraint = p.constraint
          ? ` extends ${this.resolveTypeNode(p.constraint)}`
          : "";
        const def = p.default ? ` = ${this.resolveTypeNode(p.default)}` : "";
        return `${p.name.getText()}${constraint}${def}`;
      })
      .join(", ");
    return `<${inner}>`;
  }

  private getPackageName(pathStr: string): string {
    const parts = pathStr.split("node_modules" + path.sep);
    if (parts.length > 1) {
      const pkgParts = parts[parts.length - 1].split(path.sep);
      const scope = pkgParts[0];
      if (scope.startsWith("@") && pkgParts.length > 1) {
        return `${scope}/${pkgParts[1]}`;
      }
      return scope;
    }
    return "";
  }

  private addImport(pkgName: string, typeName: string) {
    if (!this.externalImports.has(pkgName)) {
      this.externalImports.set(pkgName, new Set());
    }
    this.externalImports.get(pkgName)!.add(typeName);
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
