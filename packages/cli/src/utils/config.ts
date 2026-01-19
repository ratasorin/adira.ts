import { AdiraConfig } from "@n/adira.core.ts";
import fs from "fs";
import path from "path";

export const loadConfig = (): AdiraConfig => {
  const configPath = path.join(process.cwd(), "config.adira.json");

  const defaults: AdiraConfig = {
    output: {
      dir: "./types",
      file: "index.api.ts",
      typename: "ApiTypes",
    },

    registry: {
      name: "@demo/types",
      version: "v1.0.0",
      port: 8888,
      description: "",
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

    return config;
  } catch (error) {
    console.error("❌ Error reading config.adira.json:", error);
    return defaults;
  }
};
