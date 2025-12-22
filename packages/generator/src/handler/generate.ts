import { ImportCollector } from "src/imports/collector";
import { DiscoveredHandler } from "./types";
import { extractTypeGeneric, matchHandlerDeclaration } from "../utils";
import ts from "typescript";

export type HandlerApiDefinition = {
  RequestParams?: string;
  RequestBody?: string;
  ResponseBody?: string;
  RequestQuery?: string;
  RequestForm?: string;
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
  importCollector: ImportCollector,
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

      const paramsStr = paramsNode?.getText();
      const bodyStr = reqBodyNode?.getText();
      const queryStr = reqQueryNode?.getText();
      const responseStr = resBodyNode?.getText();

      importCollector.collectDependeciesOf(paramsNode);
      importCollector.collectDependeciesOf(reqBodyNode);
      importCollector.collectDependeciesOf(reqQueryNode);
      importCollector.collectDependeciesOf(resBodyNode);

      // Normalize endpoint key: prefix + path
      const httpPath = httpJoin(
        prefix || "",
        endpointPrefix || "",
        endpoint || "",
      );

      if (!definitions[httpPath]) definitions[httpPath] = {};

      definitions[httpPath][method.toUpperCase()] = {
        RequestParams: paramsStr,
        RequestBody: bodyStr,
        RequestQuery: queryStr,
        ResponseBody: responseStr,
      };
    });
  }
  return definitions;
}
