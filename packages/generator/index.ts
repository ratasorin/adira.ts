import { loadConfig, AdiraConfig } from "./config";
import { generateApiDefinitions } from "./generate";
import fs from "fs";
import path from "path";

export const generate = async (config?: Partial<AdiraConfig>) => {
  const fullConfig = { ...loadConfig(), ...config };
  const { routeMap, apiTypes } = await generateApiDefinitions(fullConfig);

  // Post-process for ObjectId replacement
  const generatedDir = fullConfig.generatedDir || "types";

  function replaceMongooseObjectId(dir: string) {
    function processFile(filePath: string) {
      let content = fs.readFileSync(filePath, "utf-8");
      content = content.replace(
        /^import\s+mongoose.*from\s+['"]mongoose['"].*\n/gm,
        "",
      );
      content = content.replace(/mongoose\.Types\.ObjectId/g, "ObjectIdLike");
      if (!content.includes("type ObjectIdLike =")) {
        content =
          `export type ObjectIdLike = string & { __objectIdBrand?: never };\n\n` +
          content;
      }
      fs.writeFileSync(filePath, content, "utf-8");
      console.log(`Processed ${path.relative(process.cwd(), filePath)}`);
    }

    function walkDir(dirPath: string) {
      fs.readdirSync(dirPath, { withFileTypes: true }).forEach((dirent) => {
        const fullPath = path.join(dirPath, dirent.name);
        if (dirent.isDirectory()) {
          walkDir(fullPath);
        } else if (fullPath.endsWith(".d.ts")) {
          processFile(fullPath);
        }
      });
    }

    const resolvedDir = path.resolve(process.cwd(), dir);
    if (fs.existsSync(resolvedDir)) {
      walkDir(resolvedDir);
    }
  }

  replaceMongooseObjectId(generatedDir);

  console.log("✅ Generation complete.");
  return { routeMap, apiTypes };
};

// For direct execution (if needed)
if (require.main === module) {
  generate().catch(console.error);
}
