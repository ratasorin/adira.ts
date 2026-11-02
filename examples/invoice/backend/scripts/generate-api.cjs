const fs = require("node:fs");
const path = require("node:path");
for (const name of fs.readdirSync("shared")) {
  if (name !== "package.json")
    fs.rmSync(path.join("shared", name), { recursive: true, force: true });
}
fs.mkdirSync("shared/src", { recursive: true });
const { generateApiDefinitions } = require("@n/adira.generator.ts");
const config = require("../config.adira.json");
generateApiDefinitions(config).then(() => {
  const file = config.output.file;
  // The client uses RequestPath for Express path parameters.
  const output = path.join(config.output.dir, "src", file);
  fs.writeFileSync(output, fs.readFileSync(output, "utf8").replace(/RequestParams:/g, "RequestPath:"));
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
