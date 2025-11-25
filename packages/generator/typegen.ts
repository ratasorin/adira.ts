import ts from "typescript";
import path from "path";
import { RouteMeta } from "./parser";
import { existsSync } from "fs";

/**
 * Defines the simplest API type definition, without generics.
 * This covers the standard Express Request/Response generics.
 */
export interface SimpleTypeDefinition {
  RequestParams?: string;
  RequestBody?: string;
  ResponseBody?: string;
  RequestQuery?: string;
  RequestForm?: string;
}

/**
 * Represents a single generic type parameter.
 * Example: `T extends SomeType`
 */
export interface GenericParam {
  name: string; // `T`
  constraint?: string; // `SomeType`
}

/**
 * Defines an API method type that uses one or more generic parameters.
 */
export interface GenericTypeDefinition {
  aliasName: string;
  generics: GenericParam[];
  types: SimpleTypeDefinition;
}

/**
 * An API method definition can either be:
 *  - SimpleTypeDefinition (no generics)
 *  - GenericTypeDefinition (with generics)
 */
export type MethodTypeDefinition = SimpleTypeDefinition | GenericTypeDefinition;

/**
 * The entire API type map.
 * Maps each route (path) -> HTTP method -> MethodTypeDefinition
 */
export interface APITypes {
  [route: string]: {
    [method: string]: MethodTypeDefinition;
  };
}

/**
 * Type guard for GenericTypeDefinition
 */
export function isGenericTypeDefinition(
  def: MethodTypeDefinition,
): def is GenericTypeDefinition {
  return (
    typeof def === "object" &&
    "aliasName" in def &&
    "generics" in def &&
    "types" in def
  );
}

function getConstraintText(node: ts.TypeNode): string {
  if (ts.isTypeReferenceNode(node)) {
    return node.getText();
  } else if (ts.isArrayTypeNode(node)) {
    return `${getConstraintText(node.elementType)}[]`;
  } else if (ts.isUnionTypeNode(node)) {
    return node.types.map(getConstraintText).join(" | ");
  } else if (ts.isIntersectionTypeNode(node)) {
    return node.types.map(getConstraintText).join(" & ");
  } else if (ts.isParenthesizedTypeNode(node)) {
    return `(${getConstraintText(node.type)})`;
  } else if (ts.isLiteralTypeNode(node) || ts.isTypeLiteralNode(node)) {
    return node.getText();
  } else {
    return node.getText(); // fallback
  }
}

/**
 * Type guard for SimpleTypeDefinition
 */
export function isSimpleTypeDefinition(
  def: MethodTypeDefinition,
): def is SimpleTypeDefinition {
  return !isGenericTypeDefinition(def);
}

/**
 * Mapping from filePath -> list of types imported from that file.
 */
export interface ImportMap {
  [filePath: string]: string[];
}

/**
 * Resolve an import string (like "./types") into an absolute file path.
 */
function resolveImportToAbsolutePath(
  importModule: string,
  sourceFilePath: string,
): string | null {
  const tsConfigPath = path.resolve(process.cwd(), "tsconfig.json");

  const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  if (configFile.error) {
    console.error("Error reading tsconfig.json", configFile.error);
    return null;
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsConfigPath),
  );

  const host = ts.createCompilerHost(parsedConfig.options, true);
  const resolved = ts.resolveModuleName(
    importModule,
    sourceFilePath,
    parsedConfig.options,
    host,
  );

  if (resolved.resolvedModule) {
    return resolved.resolvedModule.resolvedFileName;
  }

  const maybePath = path.resolve(
    path.dirname(sourceFilePath),
    importModule + ".ts",
  );
  return existsSync(maybePath) ? maybePath : null;
}

/**
 * Extract all `TypeReferenceNode`s from a TypeNode.
 * This is useful because generics may contain unions, intersections, or arrays.
 */
const getTypeReferencesFromNode = (
  node: ts.TypeNode,
): ts.TypeReferenceNode[] => {
  const typeReferences: ts.TypeReferenceNode[] = [];

  const extractTypeReferences = (node: ts.TypeNode) => {
    if (ts.isTypeReferenceNode(node)) {
      typeReferences.push(node);
    } else if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
      node.types.forEach(extractTypeReferences);
    } else if (ts.isArrayTypeNode(node)) {
      extractTypeReferences(node.elementType);
    } else if (ts.isParenthesizedTypeNode(node)) {
      extractTypeReferences(node.type);
    } else if (ts.isTypeOperatorNode(node)) {
      // e.g. keyof Foo
      extractTypeReferences(node.type);
    } else if (ts.isIndexedAccessTypeNode(node)) {
      // e.g. Foo["bar"]
      extractTypeReferences(node.objectType);
      extractTypeReferences(node.indexType);
    } else if (ts.isTypeLiteralNode(node)) {
      // Traverse all members (properties) of the inline object
      node.members.forEach((member) => {
        if (ts.isPropertySignature(member) && member.type) {
          // Recursively check the type of the property
          extractTypeReferences(member.type);
        }
      });
    } else if (ts.isTypeLiteralNode(node)) {
      // Traverse all members (properties) of the inline object
      node.members.forEach((member) => {
        if (ts.isPropertySignature(member) && member.type) {
          // Recursively check the type of the property
          extractTypeReferences(member.type);
        }
      });
    }
  };

  extractTypeReferences(node);
  return typeReferences;
};

/**
 * Builds a map of imported types for a source file.
 * Automatically uses the module specifier for external packages (non-relative/non-absolute imports).
 */
function buildImportSourceMap(
  sourceFile: ts.SourceFile,
): Record<string, string> {
  const importMap: Record<string, string> = {};
  const filePath = sourceFile.fileName;

  ts.forEachChild(sourceFile, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      node.importClause &&
      node.moduleSpecifier
    ) {
      const importModule = (node.moduleSpecifier as ts.StringLiteral).text;

      let sourceReference: string;

      // New Smart Check: If the module specifier does NOT start with a '.', treat it as a package.
      if (!importModule.startsWith(".")) {
        // This captures both scoped packages (@scope/pkg) and unscoped packages (pkg)
        // The source reference is the package name itself.
        sourceReference = importModule;
      } else {
        // If it starts with a '.', it's a relative import, so resolve the absolute path.
        const absPath = resolveImportToAbsolutePath(importModule, filePath);
        if (!absPath) return; // Skip if resolution fails
        sourceReference = absPath;
      }

      // Map the imported names to the determined source reference
      if (
        node.importClause.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings)
      ) {
        for (const element of node.importClause.namedBindings.elements) {
          importMap[element.name.text] = sourceReference;
        }
      }

      // Handle namespace imports: import * as Alias from 'module'
      if (
        node.importClause.namedBindings &&
        ts.isNamespaceImport(node.importClause.namedBindings)
      ) {
        const alias = node.importClause.namedBindings.name.text;
        importMap[alias] = sourceReference;
      }

      if (node.importClause.name) {
        importMap[node.importClause.name.text] = sourceReference;
      }
    }
  });

  return importMap;
}

/**
 * Check if a type is exported directly or via `export { Foo }` from this file.
 */
function getExportSourceFileOrModule(
  sourceFile: ts.SourceFile,
  typeName: string,
): string | null {
  for (const statement of sourceFile.statements) {
    // ✅ export interface Foo {}
    // ✅ export type Foo = { ... }
    if (
      (ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement)) &&
      statement.name.getText() === typeName
    ) {
      if (
        statement.modifiers &&
        statement.modifiers.some(
          (mod) => mod.kind === ts.SyntaxKind.ExportKeyword,
        )
      ) {
        return sourceFile.fileName;
      }
    }

    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause) {
        if (ts.isNamedExports(statement.exportClause)) {
          for (const element of statement.exportClause.elements) {
            if (element.name.getText() === typeName) {
              return statement.moduleSpecifier
                ? statement.moduleSpecifier.getText().slice(1, -1)
                : sourceFile.fileName;
            }
          }
        }
      }
    }
  }
  return null;
}

// Helper function to extract and process generic type parameters
const processTypeParameters = (
  typeParameters: ts.NodeArray<ts.TypeParameterDeclaration>,
  imports: ImportMap,
  file: ts.SourceFile,
  generics: GenericParam[],
) => {
  typeParameters.forEach((tp) => {
    const gp: GenericParam = { name: tp.name.getText() };
    if (tp.constraint) {
      // Use the general getConstraintText for accurate text representation
      gp.constraint = getConstraintText(tp.constraint);

      // Pass the constraint to gatherImports for dependency tracking
      gatherImports(tp.constraint, imports, file);
    }
    generics.push(gp);
  });
};

/**
 * Gather imports for a type (recursively).
 */
export const gatherImports = (
  node: ts.TypeNode | undefined,
  importMap: ImportMap,
  sourceFile: ts.SourceFile,
): ImportMap => {
  if (!node) return {};

  const importSourceMap = buildImportSourceMap(sourceFile);
  const typeReferences = getTypeReferencesFromNode(node);

  for (const typeReference of typeReferences) {
    // Recursively handle nested type arguments
    let index = 0;
    let currentNode: ts.TypeNode | undefined = extractTypeGeneric(
      typeReference,
      index,
    );

    while (currentNode) {
      gatherImports(currentNode, importMap, sourceFile);
      index++;
      currentNode = extractTypeGeneric(typeReference, index);
    }

    let typeName: string;
    let importModule: string | undefined;
    let typeReferenceExportSource: string | null;
    let importNames: string[] = [];

    if (ts.isQualifiedName(typeReference.typeName)) {
      const qualifier = typeReference.typeName.left.getText();
      typeName = typeReference.typeName.right.getText();
      importModule = importSourceMap[qualifier];
      importNames = [qualifier]; // Import the namespace/qualifier
      typeReferenceExportSource = null; // Assume qualified names are from imports, not local
    } else {
      typeName = typeReference.typeName.getText();
      importModule = importSourceMap[typeName];
      importNames = [typeName];
      typeReferenceExportSource = getExportSourceFileOrModule(
        sourceFile,
        typeName,
      );
    }

    // Handle external imports
    if (!typeReferenceExportSource && importModule) {
      if (!Array.isArray(importMap[importModule])) {
        importMap[importModule] = [];
      }
      importNames.forEach(name => {
        if (!importMap[importModule].includes(name)) {
          importMap[importModule].push(name);
        }
      });
      continue;
    }

    // Handle types exported from this file
    if (typeReferenceExportSource) {
      if (typeReferenceExportSource in importMap) {
        if (!importMap[typeReferenceExportSource].includes(typeName)) {
          importMap[typeReferenceExportSource].push(typeName);
        }
      } else {
        importMap[typeReferenceExportSource] = [typeName];
      }
    }
  }

  return importMap;
};

export interface TypesMeta {
  api: APITypes;
  imports: ImportMap;
}

/**
 * Main generator: extracts all API type information from route handlers.
 */
export async function generateTypes(routes: RouteMeta[]): Promise<TypesMeta> {
  const result: APITypes = {};
  const imports: ImportMap = {};

  const program = ts.createProgram({
    rootNames: routes.map((r) => r.handlerPath),
    options: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      allowJs: true,
      checkJs: false,
      jsx: ts.JsxEmit.Preserve,
      esModuleInterop: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: false,
    },
  });

  // THIS IS ABSOLUTELY REQUIRED FOR NODE'S CORRECT PARENT RESOLUTION!
  program.getTypeChecker();

  for (const route of routes) {
    const file = program.getSourceFile(route.handlerPath);
    if (!file) return { api: {}, imports: {} };

    ts.forEachChild(file, (node) => {
      let name: ts.Identifier | undefined;
      let parameters: ts.NodeArray<ts.ParameterDeclaration> | undefined;

      // ✅ Now supports MULTIPLE generics
      let generics: GenericParam[] = [];

      if (ts.isVariableStatement(node)) {
        const decl = node.declarationList.declarations[0];
        if (
          ts.isVariableDeclaration(decl) &&
          ts.isIdentifier(decl.name) &&
          decl.name.escapedText === route.handlerName &&
          decl.initializer &&
          ts.isArrowFunction(decl.initializer)
        ) {
          if (decl.initializer.typeParameters) {
            processTypeParameters(
              decl.initializer.typeParameters,
              imports,
              file,
              generics,
            );
          }
          name = decl.name;
          parameters = decl.initializer.parameters;
        }
      }
      // handle named functions
      else if (
        ts.isFunctionDeclaration(node) &&
        node.name &&
        ts.isIdentifier(node.name) &&
        node.name.escapedText === route.handlerName
      ) {
        name = node.name;
        parameters = node.parameters;
        if (node.typeParameters) {
          processTypeParameters(node.typeParameters, imports, file, generics);
        }
      }

      if (name && parameters) {
        const reqType = parameters[0]?.type as ts.TypeReferenceNode | undefined;
        const resType = parameters[1]?.type as ts.TypeReferenceNode | undefined;

        // Those are the path parameters: (/api/invoices/id/:invoice_id)
        // defined in express as the first argument of the `Request` generic: P = core.ParamsDictionary
        const paramsDict = extractTypeGeneric(reqType, 0);
        const body = extractTypeGeneric(reqType, 2);
        const query = extractTypeGeneric(reqType, 3);
        const res = extractTypeGeneric(resType, 0);

        //   The types inside a generic can be:
        //         1. TypeReferenceNode: Generic<A>
        //         2. ObjectTypeNode: Generic<{ message: string }>
        //         3. UnionTypeNode: Generic<A | { ... }>
        //         4. ArrayType: Generic<A[]>
        gatherImports(body, imports, file);
        gatherImports(query, imports, file);
        gatherImports(res, imports, file);
        gatherImports(paramsDict, imports, file);

        const key = path.join(route.prefix || "", route.path || "");
        result[key] = {
          ...result[key],
          [route.method.toUpperCase()]:
            generics.length > 0
              ? {
                  aliasName: key.concat(route.method || "").replace(/\//g, "_"),
                  generics,
                  types: {
                    RequestParams: paramsDict?.getText(),
                    RequestBody: body?.getText(),
                    ResponseBody: res?.getText(),
                    RequestQuery: query?.getText(),
                    RequestForm: "",
                  },
                }
              : {
                  RequestParams: paramsDict?.getText(),
                  RequestBody: body?.getText(),
                  ResponseBody: res?.getText(),
                  RequestQuery: query?.getText(),
                  RequestForm: "",
                },
        };
      }
    });
  }
  return { api: result, imports };
}

/**
 * Extract a type argument from a TypeReferenceNode at a given index.
 * Example: Request<A, B, C> → extractTypeGeneric(node, 1) = B
 */
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
    const typeArg = node.typeArguments[index];
    if (ts.isTypeNode(typeArg)) {
      if (typeArg.getSourceFile()) {
        return typeArg;
      }
    }
  }
  return undefined;
}
