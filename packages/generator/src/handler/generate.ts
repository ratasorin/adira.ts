import { DiscoveredHandler } from "./types";
import { extractTypeGeneric, matchHandlerDeclaration } from "../utils";
import ts from "typescript";
import { SymbolCollector } from "src/imports/collector";

export type HandlerApiDefinition = {
  RequestParams?: ts.Symbol;
  RequestBody?: ts.Symbol;
  ResponseBody?: ts.Symbol;
  RequestQuery?: ts.Symbol;
  RequestForm?: ts.Symbol;
};

export type ApiDefinition = {
  [endpoint: string]: {
    [method: string]: HandlerApiDefinition;
  };
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
  const checker = program.getTypeChecker();

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

    ts.forEachChild(sourceFile, (node) => {
      const fnInfo = matchHandlerDeclaration(node, handlerName);
      if (!fnInfo) return;

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

      const params = checker.getSymbolAtLocation(paramsNode);
      const body = checker.getSymbolAtLocation(reqBodyNode);
      const query = checker.getSymbolAtLocation(reqQueryNode);
      const response = checker.getSymbolAtLocation(resBodyNode);

      if (!params || !body || !query || !response) {
        throw new Error(
          `[API Object Generator] Failed to extract all required symbols from '${handlerName}'`,
        );
      }

      symbolCollecor.collect(new Set([params, body, query, response]));

      // Normalize endpoint key: prefix + path
      const httpPath = httpJoin(
        prefix || "",
        endpointPrefix || "",
        endpoint || "",
      );

      if (!definitions[httpPath]) definitions[httpPath] = {};

      definitions[httpPath][method.toUpperCase()] = {
        RequestParams: params,
        RequestBody: body,
        RequestQuery: query,
        ResponseBody: response,
      };
    });
  }
  return definitions;
}
