import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import ts from "typescript";
import { generateApiDefinitions } from "../../generator/src";

test("real Express declarations preserve the resource contract and specialize client results", async () => {
  const root = resolve(__dirname, "../../..");
  // Keep declaration resolution next to the workspace's installed dependencies.
  const output = await mkdtemp(join(root, ".adira-types-"));
  const previousDirectory = process.cwd();
  try {
    process.chdir(join(root, "examples/backend"));
    await generateApiDefinitions({
      output: {
        dir: output,
        file: "index.api.d.ts",
        typename: "ExampleApiTypes",
      },
      registry: {
        name: "@examples/backend.types",
        port: 8888,
        url: "http://localhost",
        version: "1.0.0",
        description: "Test declarations",
      },
      allowedDependencies: ["@n/adira.core.ts"],
    });
    process.chdir(previousDirectory);
    const contract = await readFile(
      join(output, "src/controller/composable-categories.d.ts"),
      "utf8",
    );
    assert.match(contract, /ReadExecutor/);
    assert.doesNotMatch(
      contract,
      /@n\/adira\.backend\.ts|mongoose|MongoPlan|AppPlan/,
    );
    const batchContract = await readFile(
      join(output, "src/controller/batch-category-summary.d.ts"),
      "utf8",
    );
    assert.match(batchContract, /ReadExecutor/);
    assert.doesNotMatch(
      batchContract,
      /RequestContext|InventoryService|requestId|inventory|mongoose|@n\/adira\.backend\.ts/,
    );
    async function declarations(directory: string): Promise<string[]> {
      const entries = await readdir(directory, { withFileTypes: true });
      return (
        await Promise.all(
          entries.map(async (entry) =>
            entry.isDirectory()
              ? declarations(join(directory, entry.name))
              : entry.name.endsWith(".d.ts")
                ? [await readFile(join(directory, entry.name), "utf8")]
                : [],
          ),
        )
      ).flat();
    }
    assert.doesNotMatch(
      (await declarations(output)).join("\n"),
      /RequestContext|InventoryService|summarizeCategories|services\/inventory|read-context/,
    );
    const consumer = join(output, "consumer.ts");
    await writeFile(
      consumer,
      `
      import { createApiClient } from "@n/adira.client.ts";
      import type { ExampleApiTypes } from "./src/index.api";
      const api = createApiClient<ExampleApiTypes>("http://localhost");
      const request = api("/categories/composable", "GET")({ query: {
        select: { name: true, stockTotal: true, productCount: true, stockAverage: true, topProductName: true, products: { select: { stock: true } }, createdBy: { select: { initials: true } } },
        where: { $or: [{ name: { $startsWith: "A" } }, { $not: { eligible: { $eq: false } } }] },
      } });
      async function verify() {
        const response = await request.run();
        if ("error" in response) { const message: string = response.message; return message; }
        const row = response.rows[0];
        const name: string = row.name;
        const stock: number = row.products[0].stock;
        const stockTotal: number = row.stockTotal;
        const productCount: number = row.productCount;
        const stockAverage: number | null = row.stockAverage;
        const topProductName: string | null = row.topProductName;
        // @ts-expect-error Empty numeric aggregations retain nullability through generation.
        const nonNullableAverage: number = row.stockAverage;
        // @ts-expect-error Relation-derived fields retain their scalar type across generation.
        const wrongTotal: string = row.stockTotal;
        const initials: string | undefined = row.createdBy?.initials;
        // @ts-expect-error Names did not widen to any across generation.
        const wrong: number = row.name;
        // @ts-expect-error The unselected public field is absent.
        row.slug;
        // @ts-expect-error The unselected nested field is absent.
        row.createdBy?.name;
        return { name, stock, initials };
      }
      // @ts-expect-error Predicate operands survive generation.
      api("/categories/composable", "GET")({ query: { select: { name: true }, where: { eligible: { $eq: "yes" } } } });
      // @ts-expect-error Grouping is not exposed in the new endpoint.
      api("/categories/composable", "GET")({ query: { select: { name: true }, groupBy: ["name"] } });
      async function verifyContextualReader() {
        const response = await api("/categories/batch-summary", "GET")({ query: {
          select: { name: true, summary: { select: { stockTotal: true } } },
        } }).run();
        if ("error" in response) return response.message;
        const row = response.rows[0];
        const stock: number = row.summary.stockTotal;
        // @ts-expect-error Selected fields preserve their scalar type.
        const wrong: string = row.summary.stockTotal;
        // @ts-expect-error Unselected relation fields remain absent.
        row.summary.productCount;
        // @ts-expect-error Backend context is not a selectable public field.
        row.inventory;
        return stock;
      }
    `,
    );
    const program = ts.createProgram([consumer], {
      target: ts.ScriptTarget.ES2021,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      strict: true,
      esModuleInterop: true,
      noEmit: true,
      skipLibCheck: false,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(
      diagnostics.length,
      0,
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => root,
        getNewLine: () => "\n",
      }),
    );
  } finally {
    process.chdir(previousDirectory);
    await rm(output, { recursive: true, force: true });
  }
});
