import fs from "fs";
import path from "path";

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
    url: "https://api.npoint.io/fcaa5cc8c9576343708c",
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

  // Create config.adira.json
  const configPath = path.join(rootDir, "config.adira.json");
  const configContent = JSON.stringify(
    {
      inputSrc: "./src",
      generatedDir: "./types",
      verdaccioPort: 8888,
    },
    null,
    2,
  );

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, configContent);
    console.log("✅ Created config.adira.json");
  } else {
    console.log("⚠️  config.adira.json already exists, skipping creation");
  }

  console.log("✅ adira.ts initialization complete!");
  console.log("\nNext steps:");
  console.log("1. Review the generated config.adira.json file");
  console.log("2. Run `npx adira.ts generate` to generate API types");
};
