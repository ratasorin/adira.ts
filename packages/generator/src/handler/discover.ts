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
  checker: ts.TypeChecker,
): Promise<DiscoveredHandler[]> {
  const DiscoveredHandler: DiscoveredHandler[] = [];
  const importMap: Record<string, ImportInfo> = {};

  const routerMountMap: Record<string, string> = {};

  for (const source of sourceFiles) {
    // Detect app.use("/prefix", router)
    ts.forEachChild(source, (node) => {
      const mainRouterDef = detectMainAppRouter(node, checker);
      if (mainRouterDef) {
        const { prefix, router } = mainRouterDef;
        if (!router) {
          throw new Error("Router not found");
        }

        const routerImportAbsolutePath = router
          ?.getDeclarations()?.[0]
          .getSourceFile().fileName;

        if (routerImportAbsolutePath) {
          // Store the prefix using the absolute path of the router file
          routerMountMap[routerImportAbsolutePath] = prefix;
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

          const handler = args.slice(-1)[0];
          const handlerSymbol = checker.getSymbolAtLocation(handler)!;
          const originalHandlerSymbol =
            checker.getAliasedSymbol(handlerSymbol)!;

          const handlerName = handlerSymbol.getName();
          const handlerPath =
            originalHandlerSymbol.declarations?.[0].getSourceFile().fileName;

          const endpointPrefix = sourceFilename
            ? routerMountMap[sourceFilename]
            : "";

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
