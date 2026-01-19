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

  let globalPrefix = "";

  for (const source of sourceFiles) {
    // Detect app.use("/prefix", router)
    ts.forEachChild(source, (node) => {
      const mainRouterDef = detectMainAppRouter(node, checker);
      if (!mainRouterDef) return;

      const { prefix, router } = mainRouterDef;
      if (!router) {
        throw new Error("Router not found");
      }

      globalPrefix = prefix;
    });
  }

  for (const source of sourceFiles) {
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

          if (endpoint && handlerPath) {
            DiscoveredHandler.push({
              method,
              endpoint,
              handler: {
                name: handlerName,
                sourcePath: handlerPath,
              },
              endpointPrefix: globalPrefix,
            });
          }
        }
      }
    });
  }

  return DiscoveredHandler;
}
