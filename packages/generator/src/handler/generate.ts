import { DiscoveredHandler } from "./types";
import { extractTypeGeneric, matchHandlerDeclaration } from "../utils";
import ts from "typescript";
import { SymbolCollector } from "src/imports/collector";
import { getSymbolsName } from "src/utils/tests";

export type HandlerApiDefinition = {
  RequestParams?: ts.TypeNode;
  RequestBody?: ts.TypeNode;
  ResponseBody?: ts.TypeNode;
  RequestQuery?: ts.TypeNode;
  RequestForm?: ts.TypeNode;
};

export type ApiDefinition = {
  [endpoint: string]: {
    [method: string]: HandlerApiDefinition;
  };
};

const getSymbolOfNode = (node: ts.Node, checker: ts.TypeChecker) => {
  const type = checker.getTypeAtLocation(node);
  const symbol = type?.getSymbol();
  return symbol;
};

const httpJoin = (...segments: string[]) => {
  return segments
    .map((s) => s.trim())
    .filter(Boolean) // Remove empty strings
    .join("/") // Join with a single slash
    .replace(/\/+/g, "/"); // Collapse any sequence of multiple slashes (///) into one (/)
};

export async function generateApiDefinitonForHandlers(
  handlers: DiscoveredHandler[],
  program: ts.Program,
  symbolCollecor: SymbolCollector,
): Promise<ApiDefinition> {
  const definitions: ApiDefinition = {};

  for (const {
    endpoint,
    endpointPrefix,
    handler,
    method,
    prefix,
  } of handlers) {
    const sourceFile = program.getSourceFile(handler.sourcePath);

    if (!sourceFile)
      throw new Error(
        `Source file ${handler.sourcePath} not found in the current program`,
      );

    const handlerName = handler.name;

    for (const statement of sourceFile.statements) {
      const fnInfo = matchHandlerDeclaration(statement, handlerName);
      if (!fnInfo) continue;

      const { parameters } = fnInfo;

      const reqType = parameters[0]?.type;
      const resType = parameters[1]?.type;

      // Extract standard Express generic parameters:
      // Request<Params, ResBody, ReqBody, ReqQuery>
      const paramsNode = extractTypeGeneric(reqType, 0);
      const resBodyNode = extractTypeGeneric(resType, 0); // Response<T>
      const reqBodyNode = extractTypeGeneric(reqType, 2);
      const reqQueryNode = extractTypeGeneric(reqType, 3);

      if (!paramsNode || !reqBodyNode || !reqQueryNode || !resBodyNode) {
        throw new Error(
          `[API Object Generator] Failed to extract all required nodes from '${handlerName}'`,
        );
      }

      symbolCollecor.collectFromNodes(
        new Set([paramsNode, reqBodyNode, reqQueryNode, resBodyNode]),
      );

      // Normalize endpoint key: prefix + path
      const httpPath = httpJoin(
        prefix || "",
        endpointPrefix || "",
        endpoint || "",
      );

      if (!definitions[httpPath]) definitions[httpPath] = {};

      definitions[httpPath][method.toUpperCase()] = {
        RequestParams: paramsNode,
        RequestBody: reqBodyNode,
        RequestQuery: reqQueryNode,
        ResponseBody: resBodyNode,
      };
    }
  }
  return definitions;
}
