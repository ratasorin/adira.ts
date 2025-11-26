import {
  GenericParam,
  isGenericTypeDefinition,
  isSimpleTypeDefinition,
  SimpleTypeDefinition,
  TypesMeta,
} from "./typegen";
import fs from "fs";
import path from "path";

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
  types: TypesMeta,
  apiTypeName: string,
  generatedDir?: string,
) {
  const { api, imports, definitions } = types;
  let output = "";

  const outputDir =
    generatedDir || path.join(process.cwd(), "src", "generated");

  // 1. Write Imports (Whitelisted)
  output += `// --------------------------------------------------------------------------\n`;
  output += `// This file is auto-generated. Do not edit directly.\n`;
  output += `// --------------------------------------------------------------------------\n\n`;

  if (imports.length > 0) {
    output += `// --- Whitelisted Dependencies ---\n`;
    imports.forEach((line) => (output += `${line}\n`));
    output += `\n`;
  }

  // 2. Write Inlined Definitions
  output += `// --- Inlined Backend Types ---\n`;

  // Always provide ObjectIdLike fallback if Mongoose was stripped
  if (!definitions.some((d) => d.includes("type ObjectIdLike"))) {
    output += `export type ObjectIdLike = string;\n\n`;
  }

  definitions.forEach((def) => {
    output += `${def}\n\n`;
  });

  // 3. Write Generic Aliases
  const uniqueAliases = new Map<
    string,
    { generics: GenericParam[]; types: SimpleTypeDefinition }
  >();
  for (const route of Object.values(api)) {
    for (const meta of Object.values(route)) {
      if (isGenericTypeDefinition(meta)) {
        uniqueAliases.set(meta.aliasName, {
          generics: meta.generics,
          types: meta.types,
        });
      }
    }
  }

  for (const [aliasName, { generics, types }] of uniqueAliases) {
    const genericDecl = generics
      .map((g) => (g.constraint ? `${g.name} extends ${g.constraint}` : g.name))
      .join(", ");

    output += `export type ${aliasName}<${genericDecl}> = {\n`;
    for (const [key, type] of Object.entries(types)) {
      output += `  ${key}?: ${type || "unknown"};\n`;
    }
    output += `};\n\n`;
  }

  // 4. Write API Definition
  output += `export type ${apiTypeName} = {`;
  for (const [route, methods] of Object.entries(api)) {
    output += `\n  "${route}": {\n`;
    for (const [method, def] of Object.entries(methods)) {
      if (isGenericTypeDefinition(def)) {
        const genericDecl = def.generics
          .map((g) =>
            g.constraint ? `${g.name} extends ${g.constraint}` : g.name,
          )
          .join(", ");
        const genericNames = def.generics.map((g) => g.name).join(", ");
        output += `    "${method}": <${genericDecl}>() => ${def.aliasName}<${genericNames}>;\n`;
      } else if (isSimpleTypeDefinition(def)) {
        output += `    "${method}": {\n`;
        for (const [key, value] of Object.entries(def)) {
          if (value) output += `      ${key}?: ${value};\n`;
        }
        output += `    };\n`;
      }
    }
    output += `  };\n`;
  }
  output += `};\n`;

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, "index.api.ts");
  fs.writeFileSync(outputPath, output);

  // 5. Generate Package JSON
  generatePackageJson(outputDir, imports, apiTypeName);
}
