import fs from "fs";
import path from "path";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
};

export const initAction = async () => {
  console.log("🚀 Initializing adira.ts configuration...");

  const rootDir = process.cwd();
  // Update or create .vscode/settings.json with json.schemas
  const vscodeDir = path.join(rootDir, ".vscode");
  const settingsPath = path.join(vscodeDir, "settings.json");

  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
    console.log("✅ Created .vscode directory");
  }

  let settings: Record<string, any> = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    console.log("📝 Updating existing .vscode/settings.json");
  } else {
    console.log("✅ Creating .vscode/settings.json");
  }

  if (!settings["json.schemas"]) {
    settings["json.schemas"] = [];
  }

  const schemaEntry = {
    fileMatch: ["**/*.adira.json"],
    url: "https://api.npoint.io/f821676f30b6107397f0",
  };

  const existingEntryIndex = settings["json.schemas"].findIndex(
    (entry: Record<string, any>) =>
      entry.fileMatch &&
      entry.fileMatch.includes("*.adira.json") &&
      entry.url === "./adira/schemas/def.json",
  );

  if (existingEntryIndex === -1) {
    settings["json.schemas"].push(schemaEntry);
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log("✅ Added JSON schema reference to .vscode/settings.json");
  } else {
    console.log(
      "⚠️  JSON schema reference already exists in .vscode/settings.json",
    );
  }

  // Check for config.adira.json and handle user input if it doesn't exist
  const configPath = path.join(rootDir, "config.adira.json");
  let config: any = {};

  if (!fs.existsSync(configPath)) {
    console.log(
      "\n📝 config.adira.json not found. Let's set up your configuration:",
    );

    // Get package.json for defaults
    let packageName = "@api/types";
    let packageVersion = "1.0.0";
    try {
      const packagePath = path.join(rootDir, "package.json");
      if (fs.existsSync(packagePath)) {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
        packageName = packageJson.name || packageName;
        packageVersion = packageJson.version || packageVersion;
      }
    } catch (error) {
      console.log("⚠️ Warning: Could not read package.json, using defaults");
    }

    // Ask for input configuration
    const inputDir =
      (await question("Input directory (default: ./src): ")) || "./src";

    // Ask for output configuration
    const outputDir =
      (await question("Output directory (default: ./types): ")) || "./types";
    const outputFile =
      (await question("Output file name (default: index.api.ts): ")) ||
      "index.api.ts";
    const typeName =
      (await question("Type name (default: ApiTypes): ")) || "ApiTypes";

    // Ask for registry configuration
    const registryName =
      (await question(`Registry name (default: ${packageName}): `)) ||
      packageName;
    const registryPort =
      (await question("Registry port (default: 8888): ")) || "8888";
    const registryUrl =
      (await question("Registry URL (default: http://localhost): ")) ||
      "http://localhost";
    const registryVersion =
      (await question(`Registry version (default: ${packageVersion}): `)) ||
      packageVersion;

    config = {
      input: {
        dir: inputDir,
      },
      output: {
        dir: outputDir,
        file: outputFile,
        typename: typeName,
      },
      registry: {
        name: registryName,
        port: parseInt(registryPort),
        url: registryUrl,
        version: registryVersion,
      },
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log("✅ Created config.adira.json");
    rl.close();
  } else {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      console.log("✅ Found existing config.adira.json");
    } catch (error) {
      console.log("❌ Error reading config.adira.json");
      rl.close();
      return;
    }
  }

  // Generate tsconfig.api.ts
  const tsconfigPath = path.join(rootDir, "tsconfig.api.json");
  const outputDistDir = path.join(config.output.dir, "dist");

  const tsconfig = {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "node",
      declaration: true,
      emitDeclarationOnly: true,
      outDir: outputDistDir,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      allowSyntheticDefaultImports: true,
      declarationMap: true,
      sourceMap: true,
      removeComments: false,
      preserveConstEnums: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      lib: ["ES2020", "DOM"],
      types: ["node"],
    },
    files: [path.join(config.output.dir, config.output.file)],
    include: [config.input.dir + "/**/*"],
    exclude: [
      "node_modules",
      "dist",
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/__tests__/**/*",
    ],
  };

  fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  console.log("✅ Generated tsconfig.api.json");

  // Generate package.json in output directory
  const outputPackagePath = path.join(
    rootDir,
    config.output.dir,
    "package.json",
  );
  const outputFileName = config.output.file.replace(".ts", "");
  const dtsFileName = outputFileName + ".d.ts";

  const outputPackage = {
    name: config.registry.name,
    version: config.registry.version,
    description: "Generated API type definitions",
    main: `dist/${dtsFileName}`,
    types: `dist/${dtsFileName}`,
    files: ["dist/**/*"],
    keywords: ["api", "types", "adira"],
    license: "MIT",
    publishConfig: {
      registry: config.registry.url + ":" + config.registry.port,
    },
  };

  // Create output directory if it doesn't exist
  if (!fs.existsSync(path.dirname(outputPackagePath))) {
    fs.mkdirSync(path.dirname(outputPackagePath), { recursive: true });
  }

  fs.writeFileSync(outputPackagePath, JSON.stringify(outputPackage, null, 2));
  console.log(`✅ Generated package.json in ${config.output.dir}`);

  console.log("✅ adira.ts initialization complete!");
  console.log("\nNext steps:");
  console.log("1. Review the generated config.adira.json file");
  console.log("2. Review the generated tsconfig.api.json file");
  console.log("3. Run `npx adira.ts generate` to generate API types");
  console.log("4. Run `tsc -p tsconfig.api.json` to compile type definitions");
};
