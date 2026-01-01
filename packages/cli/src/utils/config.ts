import { AdiraConfig } from "@n/adira.core.ts";
import fs from "fs";
import path from "path";

export const loadConfig = (): AdiraConfig => {
  const configPath = path.join(process.cwd(), "config.adira.json");

  // Get package.json for default name and version
  let packageName: string = "@project/api";
  let packageVersion: string = "1.0.0";
  try {
    const packagePath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      packageName = packageJson.name || packageName;
      packageVersion = packageJson.version || packageVersion;
    }
  } catch (error) {
    console.log("⚠️ Warning: Could not read package.json, using defaults");
  }

  const defaults: AdiraConfig = {
    output: {
      dir: "./types",
      file: "index.api.ts",
      typename: "ApiTypes",
    },
    registry: {
      name: packageName,
      version: packageVersion,
      port: 8888,
      url: "http://localhost",
    },
    allowedDependencies: ["@n/adira.core.ts"],
  };

  if (!fs.existsSync(configPath)) {
    console.log(
      "⚠️ Warning: File config.adira.json was not found, using defaults",
    );
    return defaults;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    // Handle legacy config format compatibility
    const legacyConfig: Partial<AdiraConfig> = {};

    if (config.generatedDir) {
      legacyConfig.output = {
        dir: config.generatedDir,
        file: defaults.output.file,
        typename: defaults.output.typename,
      };
    }
    if (config.verdaccioPort) {
      legacyConfig.registry = {
        name: defaults.registry.name,
        port: config.verdaccioPort,
        url: defaults.registry.url,
        version: defaults.registry.version,
      };
    }

    // Merge: defaults -> legacyConfig -> config
    const mergedConfig = {
      ...defaults,
      ...legacyConfig,
      ...config,
    };

    if (config.output || legacyConfig.output) {
      mergedConfig.output = {
        ...defaults.output,
        ...legacyConfig.output,
        ...config.output,
      };
    }
    if (config.registry || legacyConfig.registry) {
      mergedConfig.registry = {
        ...defaults.registry,
        ...legacyConfig.registry,
        ...config.registry,
      };
    }

    return mergedConfig;
  } catch (error) {
    console.error("❌ Error reading config.adira.json:", error);
    return defaults;
  }
};
