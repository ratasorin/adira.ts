import {
  isGenericTypeDefinition,
  isSimpleTypeDefinition,
  SimpleTypeDefinition,
  TypesMeta,
  GenericParam,
} from "./typegen";
import fs from "fs";
import path from "path";

// Utility function to get the relative import path
const getRelativeImportPath = (from: string, to: string): string => {
  // Ensure both paths are absolute
  const absoluteFrom = path.resolve(from);
  const absoluteTo = path.resolve(to);

  // Get the relative path between the two
  const relativePath = path.relative(absoluteFrom, absoluteTo);

  // Return the relative path with the correct module import style
  return relativePath.replace(/\.ts$/, "");
};

export function writeTypes(types: TypesMeta, generatedDir?: string) {
  const { api, imports } = types;
  let output = "";

  const outputDir = generatedDir || path.join(process.cwd(), "src", "generated");

  // 🔹 Step 1: Write imports
  for (const [pathName, typeReferences] of Object.entries(imports)) {
    const importsJoined = typeReferences.join(", ");
    if (pathName.startsWith("/")) {
      const relativePath = getRelativeImportPath(
        outputDir,
        pathName
      );
      output += `import { ${importsJoined} } from '${relativePath}';\n`;
    } else {
      output += `import { ${importsJoined} } from '${pathName}';\n`;
    }
  }

  // 🔹 Step 2: Collect unique aliases for generic definitions
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

  // 🔹 Step 3: Write alias type definitions for generics
  for (const [aliasName, { generics, types }] of uniqueAliases) {
    // Format generic parameter list, e.g. `<T extends Foo, U, V extends Bar>`
    const genericDecl = generics
      .map((g) => (g.constraint ? `${g.name} extends ${g.constraint}` : g.name))
      .join(", ");

    output += `\nexport type ${aliasName}<${genericDecl}> = {\n`;
    for (const [key, type] of Object.entries(types)) {
      output += `  ${key}?: ${type || "unknown"};\n`;
    }
    output += `};\n`;
  }

  // 🔹 Step 4: Write API type definition
  output += `\nexport type InvoicifyAPI = {`;

  // Iterating through each route and method
  for (const [route, methods] of Object.entries(api)) {
    output += `\n  "${route}": {\n`;
    for (const [method, def] of Object.entries(methods)) {
      if (isGenericTypeDefinition(def)) {
        // Build generic parameter list for function signature
        const genericDecl = def.generics
          .map((g) =>
            g.constraint ? `${g.name} extends ${g.constraint}` : g.name
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

  // 🔹 Step 5: Write file
  const outputPath = path.join(outputDir, "index.api.ts");
  fs.writeFileSync(outputPath, output);
}
