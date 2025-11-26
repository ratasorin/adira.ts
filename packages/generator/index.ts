import { AdiraConfig } from "@n/adira.core.ts";
import { loadConfig } from "./config";
import { generateApiDefinitions } from "./generate";

export const generate = async (config?: Partial<AdiraConfig>) => {
  const fullConfig = { ...loadConfig(), ...config };

  console.log("🚀 Starting API generation...");
  console.log(`📂 New Input: ${fullConfig.input.dir}`);
  console.log(`📂 New Output: ${fullConfig.output.dir}`);

  const { routeMap, apiTypes } = await generateApiDefinitions(fullConfig);

  console.log("✅ Generation complete.");
  console.log(
    `📦 Package file created at ${fullConfig.output.dir}/package.json`,
  );

  return { routeMap, apiTypes };
};

// For direct execution
if (require.main === module) {
  generate().catch(console.error);
}
