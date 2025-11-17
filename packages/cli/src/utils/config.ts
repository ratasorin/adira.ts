import fs from "fs";
import path from "path";

export const loadConfig = () => {
  const configPath = path.join(process.cwd(), "config.adira.json");
  const defaults = {
    inputSrc: "./src",
    generatedDir: "./types",
    verdaccioPort: 8888,
  };

  if (!fs.existsSync(configPath)) {
    console.log(
      "⚠️ Warning: File config.adira.json was not found, using defaults",
    );
    return defaults;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return { ...defaults, ...config };
  } catch (error) {
    console.error("❌ Error reading config.adira.json:", error);
    return defaults;
  }
};
