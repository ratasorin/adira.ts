import ts from "typescript";
import { DiscoveredHandler, ImportInfo, METHOD } from "./types";
import {
  detectMainAppRouter,
  findRouteHandlerDefiniton,
  trackImports,
} from "./utils";

export async function discoverRouterDefinitions(
  sourceFiles: readonly ts.SourceFile[],
  tsConfig: ts.CompilerOptions,
): Promise<DiscoveredHandler[]> {
  const DiscoveredHandler: DiscoveredHandler[] = [];
  const importMap: Record<string, ImportInfo> = {};

  /**
   * Maps a router's import path to the URL prefix where that router
   * is mounted via `app.use(prefix, router)`.
   * Example: if `app.use('/api', userRouter)` and `userRouter` resolves to
   * '/abs/path/src/routes/user.ts', then:
   * routerMountMap['/abs/path/src/routes/user.ts'] === '/api'
   */
  let routerMountMap: Record<string, string> = {};

  for (const source of sourceFiles) {
    // correlate each symbol with it's absolute import path
    ts.forEachChild(source, (node) => {
      trackImports(source.fileName, node, tsConfig, importMap);
    });
  }

  for (const source of sourceFiles) {
    // Detect app.use("/prefix", router)
    ts.forEachChild(source, (node) => {
      const mainRouterDef = detectMainAppRouter(node);
      if (mainRouterDef) {
        const { prefix, routerName } = mainRouterDef;
        const routerImportAbsolutePath = importMap[routerName];

        if (routerImportAbsolutePath) {
          // Store the prefix using the absolute path of the router file
          routerMountMap[routerImportAbsolutePath.file] = prefix;
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
          const method = call.expression.name.getText() as METHOD;
          const sourceFilename = source.fileName; // where the router is used

          const args = call.arguments;

          const endpoint = ts.isStringLiteral(args[0])
            ? args[0].text
            : undefined;

          const originalHandler = args.slice(-1)[0].getText();

          const endpointPrefix = sourceFilename
            ? routerMountMap[sourceFilename]
            : "";

          const { handlerName, handlerPath } = findRouteHandlerDefiniton(
            originalHandler,
            importMap,
            tsConfig,
          );

          if (endpoint && handlerPath) {
            DiscoveredHandler.push({
              method,
              endpoint,
              handler: {
                name: handlerName,
                sourcePath: handlerPath,
              },
              endpointPrefix,
            });
          }
        }
      }
    });
  }

  return DiscoveredHandler;
}
