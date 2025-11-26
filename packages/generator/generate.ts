import { AdiraConfig } from "@n/adira.core.ts";
import { parseRoutes } from "./parser";
import { generateTypes } from "./typegen";
import { writeTypes } from "./writer";

export interface GeneratorResult {
  routeMap: any[];
  apiTypes: any;
}

export const generateApiDefinitions = async (
  config: AdiraConfig,
): Promise<GeneratorResult> => {
  // Use the configured input source or default to './src'
  const routeMap = await parseRoutes();
  const apiTypes = await generateTypes(routeMap);

  // Write types to the configured output directory
  writeTypes(apiTypes, config.output.typename || "ApiTypes", config.output.dir);

  return { routeMap, apiTypes };
};
