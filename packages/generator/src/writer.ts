import fs from "fs";
import path from "path";
import { ApiDefinition } from "src/handler/generate";

// --- Package JSON Generator Helper ---

function generatePackageJson(
  outputDir: string,
  imports: string[],
  apiName: string,
) {
  const rootPkgPath = path.resolve(process.cwd(), "package.json");
  let rootPkg: any = {};
  if (fs.existsSync(rootPkgPath)) {
    rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));
  }

  const allDeps = { ...rootPkg.dependencies, ...rootPkg.devDependencies };
  const usedDeps: Record<string, string> = {};

  // Extract package names from import statements (e.g. 'import { z } from "zod"' -> 'zod')
  imports.forEach((line) => {
    const match = line.match(/from "([^"]+)";/);
    if (match) {
      const pkgName = match[1];
      if (allDeps[pkgName]) {
        usedDeps[pkgName] = allDeps[pkgName];
      } else {
        // If not found in root, assume 'latest' or warn?
        // For now, let's look for @types too
        const typesPkg = `@types/${pkgName}`;
        if (allDeps[typesPkg]) {
          usedDeps[typesPkg] = allDeps[typesPkg];
        }
        // Don't add if we can't find a version, user can fix manually
      }
    }
  });

  const outPkg = {
    name: `@generated/${apiName.toLowerCase()}`,
    version: "0.0.1",
    description: "Auto-generated API types",
    main: "index.api.ts",
    types: "index.api.ts",
    peerDependencies: usedDeps,
    devDependencies: usedDeps, // Allows local compilation to work immediately
  };

  fs.writeFileSync(
    path.join(outputDir, "package.json"),
    JSON.stringify(outPkg, null, 2),
  );
}

// --- Main Writer ---
export function writeTypes(
  api: ApiDefinition,
  importLines: string[],
  apiTypeName: string,
  outputDir: string, // This should be the 'shared' folder root
) {
  let output = `// --------------------------------------------------------------------------\n`;
  output += `// This file is auto-generated. Do not edit directly.\n`;
  output += `// --------------------------------------------------------------------------\n\n`;

  // 1. Write Generated Imports
  if (importLines.length > 0) {
    output += importLines.join("\n") + "\n\n";
  }

  // 2. Write API Definition
  output += `export type ${apiTypeName} = {`;
  for (const [route, methods] of Object.entries(api)) {
    output += `\n  "${route}": {`;
    for (const [method, def] of Object.entries(methods)) {
      output += `\n    "${method}": {`;
      if (def.RequestParams)
        output += `\n      RequestParams: ${def.RequestParams};`;
      if (def.RequestBody) output += `\n      RequestBody: ${def.RequestBody};`;
      if (def.RequestQuery)
        output += `\n      RequestQuery: ${def.RequestQuery};`;
      if (def.ResponseBody)
        output += `\n      ResponseBody: ${def.ResponseBody};`;
      output += `\n    };`;
    }
    output += `\n  };`;
  }
  output += `\n};\n`;

  const srcDir = path.join(outputDir, "src");
  if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

  fs.writeFileSync(path.join(srcDir, "index.api.ts"), output);

  // 3. Update Package JSON
  generatePackageJson(outputDir, importLines, apiTypeName);
}
