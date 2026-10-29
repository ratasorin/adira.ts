import {
  cp,
  mkdir,
  readFile,
  writeFile,
  access,
  rm,
  readdir,
} from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "../../packages");
for (const name of ["core", "backend", "client", "generator"]) {
  const from = join(source, name);
  await access(join(from, "package.json"));
  const to = join(root, ".adira", name);
  // Refresh source so deleted upstream modules cannot survive between builds.
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(to)) {
    if (entry !== "node_modules")
      await rm(join(to, entry), { recursive: true, force: true });
  }
  await cp(from, to, {
    recursive: true,
    filter: (path) =>
      !/(^|[/\\])(node_modules|dist|test|tests|__tests__)([/\\]|$)|tsbuildinfo$/.test(
        path,
      ),
  });
  const pkg = JSON.parse(await readFile(join(to, "package.json"), "utf8"));
  for (const section of ["dependencies", "devDependencies"]) {
    for (const key of Object.keys(pkg[section] || {})) {
      if (key.startsWith("@n/adira.")) pkg[section][key] = "*";
    }
  }
  await writeFile(
    join(to, "package.json"),
    JSON.stringify(pkg, null, 2) + "\n",
  );
}
console.log("Using the current adira.ts source from this checkout.");
