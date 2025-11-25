export interface AdiraConfig {
  apiName: string;
  generatedDir?: string;
  verdaccioPort?: number;
  verdaccioBaseUrl?: string;
  inputSrc?: string;
  outputFormat?: string;
}

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

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, "utf8");
      return JSON.parse(configContent);
    }
  }

  // Return defaults if no config found
  return {
    generatedDir: "./types",
    verdaccioPort: 8888,
    verdaccioBaseUrl: "http://localhost:8888",
    inputSrc: "./src",
    outputFormat: "api.ts",
    apiName: "APITypes",
  };
};
