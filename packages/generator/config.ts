import { AdiraConfig } from "@n/adira.core.ts";

export const loadConfig = (): AdiraConfig => {
  const fs = require("fs");
  const path = require("path");

  // Look for config in current working directory (user's project)
  const configPaths = [
    path.resolve(process.cwd(), "config.adira.json"),
    path.resolve(process.cwd(), "config.nadira.json"),
    path.resolve(process.cwd(), "adira.config.json"),
    path.resolve(process.cwd(), "nadira.config.json"),
  ];

  let userConfig: Partial<AdiraConfig> = {};

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, "utf8");
      userConfig = JSON.parse(configContent);
      break;
    }
  }

  // Return defaults merged with user config
  return {
    input: {
      dir: "./src",
      ...userConfig.input,
    },
    output: {
      dir: "./shared",
      file: "index.api.ts",
      typename: "ApiTypes",
      ...userConfig.output,
    },
    registry: {
      port: 8888,
      url: "http://localhost",
      version: "1.0.0",
      name: "@app/api",
      ...userConfig.registry,
    },
    allowedDependencies: [
      ...(userConfig.allowedDependencies || []),
      "@n/adira.core.ts",
    ],
  };
};
