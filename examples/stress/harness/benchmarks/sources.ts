import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? files(resolve(directory, entry.name))
        : Promise.resolve(
            entry.name.endsWith(".ts") ? [resolve(directory, entry.name)] : [],
          ),
    ),
  );
  return groups.flat();
}

export async function businessSources(root: string): Promise<string[]> {
  const directories = ["contracts", "server", "harness/workloads"];
  const sources = (
    await Promise.all(
      directories.map((directory) => files(resolve(root, directory))),
    )
  )
    .flat()
    .map((file) => relative(root, file))
    .sort();
  return [
    ...sources,
    "harness/readers.adira.ts",
    "harness/readers.reference.ts",
  ].sort();
}

export const hashFile = async (file: string) =>
  createHash("sha256")
    .update(await readFile(file))
    .digest("hex");

export async function sourceHashes(root: string, names: readonly string[]) {
  return Object.fromEntries(
    await Promise.all(
      names.map(
        async (name): Promise<[string, string]> => [
          name,
          await hashFile(resolve(root, name)),
        ],
      ),
    ),
  );
}
