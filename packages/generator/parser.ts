import ts from "typescript";
import path from "path";
import fs from "fs";
import glob from "fast-glob";
import { loadConfig } from "./config";

/**
 * API endpoint definition identified when scanning the express `routers`
 */
export interface DiscoveredRoute {
  method: string;
  path: string;

  // The `handler` is a function used to process a request: router.get("/users", getUsersHandler)
  handler: {
    /**
     * The generator uses this as an entry point for traversing the AST and finding type declarations for RequestBody, ResponseBody, RequestParams, RequestPath
     */
    name: string;
    /**
     * The absolute file system path to the TypeScript source file containing the handler.
     *
     * This is passed to `ts.createProgram` to load the file into the compiler context.
     */
    path: string;
  };

  /**
   * An optional global prefix for the route (e.g., "/api/v1").
   * If present, this is prepended to `path` to ensure the generated SDK
   * uses the full, correct URL.
   */
  prefix?: string;
}

// Utility to get all .ts files from the configured source directory
function getAllFiles(): string[] {
  const config = loadConfig();

  // Use the configured input source or default to 'src'
  // Look in the user's project directory (process.cwd()) not the generator package
  const inputSrc = config.input.dir || "src";
  const pattern = path.join(inputSrc, "**/*.ts");
  return glob.sync(pattern, {
    absolute: true,
    cwd: process.cwd(), // Set current working directory as the root
  });
}

function resolveImport(
  fromFile: string,
  modulePath: string,
): string | undefined {
  const basePath = path.resolve(path.dirname(fromFile), modulePath);
  const tsFile = basePath + ".ts";
  const indexFile = path.join(basePath, "index.ts");

  if (fs.existsSync(tsFile)) return tsFile;
  if (fs.existsSync(indexFile)) return indexFile;
  return undefined;
}

export async function parseRoutes(): Promise<DiscoveredRoute[]> {
  const files = getAllFiles();
  const routeMetas: DiscoveredRoute[] = [];
  const importMap: Record<string, string> = {};
  let prefixMap: Record<string, string> = {};

  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );

    ts.forEachChild(source, (node) => {
      // Build import alias map for routers
      if (
        ts.isImportDeclaration(node) &&
        node.importClause &&
        node.moduleSpecifier
      ) {
        const modulePath = node.moduleSpecifier.getText().replace(/['"]/g, "");
        const resolvedPath = resolveImport(file, modulePath);

        // Handle named imports: import { router } from '...';
        if (
          node.importClause.namedBindings &&
          ts.isNamedImports(node.importClause.namedBindings)
        ) {
          node.importClause.namedBindings.elements.forEach((el) => {
            const name = el.name.getText();
            if (resolvedPath) {
              importMap[name] = resolvedPath;
            }
          });
        }

        // Handle default import: import defaultRouter from '...';
        if (node.importClause.name) {
          const defaultName = node.importClause.name.getText();
          if (resolvedPath) {
            importMap[defaultName] = resolvedPath;
          }
        }
      }

      // Detect app.use("/prefix", router)
      if (
        ts.isExpressionStatement(node) &&
        ts.isCallExpression(node.expression)
      ) {
        const { expression, arguments: args } = node.expression;

        if (
          ts.isPropertyAccessExpression(expression) &&
          expression.name.getText() === "use" &&
          args.length >= 2
        ) {
          const prefixArg = args[0];
          const routerArg = args[1];

          if (ts.isStringLiteral(prefixArg) && ts.isIdentifier(routerArg)) {
            const routerName = routerArg.getText();
            const importInfo = importMap[routerName];

            if (importInfo) {
              // Store the prefix using the absolute path of the router file
              prefixMap[importInfo] = prefixArg.text;
            }
          }
        }
      }
    });

    // Now walk router.METHOD calls
    ts.forEachChild(source, (node) => {
      if (
        ts.isExpressionStatement(node) &&
        ts.isCallExpression(node.expression)
      ) {
        const call = node.expression;
        if (
          ts.isPropertyAccessExpression(call.expression) &&
          ["get", "post", "put", "patch", "delete"].includes(
            call.expression.name.getText(),
          )
        ) {
          const method = call.expression.name.getText();
          const filename = source.fileName;

          const args = call.arguments;
          const routePath = ts.isStringLiteral(args[0])
            ? args[0].text
            : undefined;

          const handlers = args.slice(1).map((arg) => arg.getText());
          const handlerName = handlers[handlers.length - 1];
          const middlewares = handlers.slice(0, -1);

          const prefix = filename ? prefixMap[filename] : "";
          let handlerPath = importMap[handlerName];

          let handlerInCurrentFile = false;

          // For each handler found (e.g: `handleGet` in `router.get(..., handleGet)`)
          // Parse the source file to find if the handler is defined in the current file
          ts.forEachChild(source, (childNode) => {
            // Case 1: Function declaration (e.g. function handleGet(...) {})
            if (ts.isFunctionDeclaration(childNode)) {
              if (childNode.name?.getText() === handlerName) {
                handlerInCurrentFile = true;
                handlerPath = source.fileName;
              }
            }

            // Case 2: Variable declaration (e.g. const handleGet = (...) => { ... })
            if (ts.isVariableStatement(childNode)) {
              for (const decl of childNode.declarationList.declarations) {
                if (
                  ts.isIdentifier(decl.name) &&
                  decl.name.getText() === handlerName
                ) {
                  handlerInCurrentFile = true;
                  handlerPath = source.fileName;
                }
              }
            }
          });

          // check for barrel files that reexport handlers
          // Suppose we want to know where `handleGet` is truly defined using the handlerPath
          // If the handlerPath is an index.ts file, we need to resolve it to find the actual handler
          // E.g:
          // - routes/index.ts
          // export { handleGet } from './handlers';
          // - routes/handlers.ts
          // export const handleGet = (req, res) => { ... }
          if (
            !handlerInCurrentFile &&
            handlerPath &&
            handlerPath.endsWith("index.ts")
          ) {
            // Parse the index.ts to find the export for the handler
            const indexSource = ts.createSourceFile(
              handlerPath,
              fs.readFileSync(handlerPath, "utf8"),
              ts.ScriptTarget.Latest,
              true,
            );

            ts.forEachChild(indexSource, (node) => {
              if (
                ts.isExportDeclaration(node) &&
                node.moduleSpecifier &&
                ts.isStringLiteral(node.moduleSpecifier) &&
                node.exportClause
              ) {
                const exports = node.exportClause;

                exports.forEachChild((el) => {
                  const exportedName = el.getText();
                  if (exportedName === handlerName) {
                    // Found the handler in the index.ts export, resolve its actual path
                    handlerPath = resolveImport(
                      handlerPath,
                      node.moduleSpecifier
                        ?.getText()
                        ?.replace(/^['"]|['"]$/g, "") || "",
                    ) as string;
                    // Once we find the handler, we *SHOULD* stop checking further
                  }
                });
              }
            });
          }

          if (routePath && handlerPath) {
            routeMetas.push({
              method,
              path: routePath,
              handler: {
                name: handlerName,
                path: handlerPath,
              },
              prefix,
            });
          }
        }
      }
    });
  }

  return routeMetas;
}
