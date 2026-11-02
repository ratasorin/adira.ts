import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import ts from "typescript";

// These are actual compiler diagnostics for the public API, not hand-built
// messages or @ts-expect-error checks. Compile in memory; no invalid source is
// written into the workspace or included in the normal type-test program.
test("resource binding diagnostics identify the incompatible field instead of requiring fake options", () => {
  const file = path.join(__dirname, "diagnostics.fixture.ts");
  const config = ts.readConfigFile(
    path.resolve(__dirname, "../tsconfig.type-tests.json"),
    ts.sys.readFile,
  );
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.resolve(__dirname, ".."),
  );
  assert.deepEqual(parsed.errors, []);

  const source = [
    'import { defineResource, field, schema, ScalarField } from "@n/adira.core.ts";',
    'import { createReadContext, defineRead, type MongoPlan, type AppPlan, type MongoRelationPlan, type AppRelationPlan } from "../read";',
    "type Parent = { id: string };",
    "type Row = { stock: number; name: string; categoryId: string };",
    "declare const root: MongoPlan<Row>;",
    "declare const parent: AppPlan<Parent>;",
    "declare const native: MongoRelationPlan<Parent, Row>;",
    "declare const app: AppRelationPlan<Parent, Row>;",
    "declare const nullable: AppRelationPlan<Parent, { stock: number | null }>;",
    "declare const optional: AppRelationPlan<Parent, { stock?: number }>;",
    "declare const indexed: AppRelationPlan<Parent, Record<string, number>>;",
    "declare const declaredAndIndexed: AppRelationPlan<Parent, { stock: number; [key: string]: number }>;",
    "declare const broad: AppRelationPlan<Parent, { status: string }>;",
    "declare const union: AppRelationPlan<Parent, { stock: number } | { name: string }>;",
    'declare const literal: AppRelationPlan<Parent, { stock: 1; status: "active" }>;',
    "const StringStock = defineResource({ stock: field.string() });",
    "const NumberStock = defineResource({ stock: field.number() });",
    "const NullableStock = defineResource({ stock: field.number().nullable() });",
    "const MissingName = defineResource({ stock: field.number(), title: field.string() });",
    'const Status = defineResource({ status: field.enum(["active", "paused"]) });',
    "const backend = createReadContext<{ requestId: string }>();",
    'const batch = parent.related({ requires: ["id"], output: schema.object({ stock: schema.number() }), resolveBatch: ({ parents }) => parents.map(({ ref }) => ({ ref, rows: [{ stock: 1 }] })) });',
    // Valid widening and nullability must remain supported, without weakening
    // resource metadata or request/response inference.
    "native.one(NumberStock); native.many(NumberStock); app.one(NumberStock);",
    "literal.one(NumberStock); literal.one(Status); literal.one(defineResource({ status: field.string() }));",
    "nullable.one(NullableStock); batch.one(NumberStock); declaredAndIndexed.one(NumberStock);",
    "defineRead(NumberStock, { source: root }); backend.defineRead(NumberStock, { source: root });",
  ];
  const cases: { name: string; line: number; patterns: RegExp[] }[] = [];
  function check(name: string, expression: string, ...patterns: RegExp[]) {
    cases.push({ name, line: source.length, patterns });
    source.push(expression);
  }
  check("native one", "native.one(StringStock);", /stock/, /string/, /number/);
  check(
    "native many",
    "native.many(StringStock);",
    /stock/,
    /string/,
    /number/,
  );
  check("app one", "app.one(StringStock);", /stock/, /string/, /number/);
  check("app many", "app.many(StringStock);", /stock/, /string/, /number/);
  check(
    "explicit options cannot bypass validation",
    "native.one(StringStock, {});",
    /stock/,
    /string/,
    /number/,
  );
  check(
    "batch provider",
    "batch.one(StringStock);",
    /stock/,
    /string/,
    /number/,
  );
  check(
    "missing field",
    "native.one(MissingName);",
    /title/,
    /missingFromPlan/,
  );
  check(
    "nullable output",
    "nullable.one(NumberStock);",
    /stock/,
    /outputTypeMismatch/,
    /expected: number/,
    /received: number \| null/,
  );
  check(
    "optional output",
    "optional.one(NumberStock);",
    /stock/,
    /missingFromPlan/,
  );
  check(
    "optional undefined output still needs a field",
    "optional.one(defineResource({ stock: new ScalarField(schema.custom<number | undefined>((value) => value as number | undefined)) }));",
    /stock/,
    /missingFromPlan/,
  );
  check(
    "index signature does not guarantee a field",
    "indexed.one(NumberStock);",
    /stock/,
    /missingFromPlan/,
  );
  check(
    "union output must cover every row",
    "union.one(NumberStock);",
    /stock/,
    /missingFromPlan/,
  );
  check(
    "broad enum output",
    "broad.one(Status);",
    /status/,
    /outputTypeMismatch/,
    /expected:/,
    /active/,
    /received: string/,
  );
  check(
    "adding a diagnostic-looking property cannot bypass nullability",
    "nullable.one(defineResource({ stock: Object.assign(field.number(), { outputTypeMismatch: { expected: 0, received: null } }) }));",
    /stock/,
    /outputTypeMismatch/,
    /received: number \| null/,
  );
  check(
    "adding a diagnostic-looking property cannot supply a missing plan field",
    'native.one(defineResource({ title: Object.assign(field.string(), { missingFromPlan: "title" }) }));',
    /title/,
    /missingFromPlan/,
  );
  check(
    "root reader",
    "defineRead(StringStock, { source: root });",
    /stock/,
    /string/,
    /number/,
  );
  check(
    "contextual reader",
    "backend.defineRead(StringStock, { source: root });",
    /stock/,
    /string/,
    /number/,
  );
  check(
    "legacy one",
    'parent.one(StringStock, { plan: root, localField: "id", foreignField: "categoryId" });',
    /stock/,
    /string/,
    /number/,
  );
  check(
    "legacy many",
    'parent.many(StringStock, { plan: root, localField: "id", foreignField: "categoryId" });',
    /stock/,
    /string/,
    /number/,
  );

  const host = ts.createCompilerHost(parsed.options);
  const original = host.getSourceFile;
  host.getSourceFile = (name, languageVersion, onError, fresh) =>
    path.resolve(name) === file
      ? ts.createSourceFile(name, source.join("\n"), languageVersion, true)
      : original(name, languageVersion, onError, fresh);
  const program = ts.createProgram([file], parsed.options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const byLine = new Map<number, ts.Diagnostic[]>();
  for (const diagnostic of diagnostics) {
    assert.equal(
      diagnostic.file?.fileName,
      file,
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    );
    const line = diagnostic.file!.getLineAndCharacterOfPosition(
      diagnostic.start!,
    ).line;
    assert.ok(
      cases.some((entry) => entry.line === line),
      `Unexpected diagnostic on line ${line + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`,
    );
    byLine.set(line, [...(byLine.get(line) ?? []), diagnostic]);
  }
  for (const { name, line, patterns } of cases) {
    const errors = byLine.get(line) ?? [];
    assert.equal(
      errors.length,
      1,
      `${name}: expected one diagnostic on the binding`,
    );
    const error = errors[0];
    assert.equal(
      error.code,
      2345,
      `${name}: expected an argument compatibility error`,
    );
    const message = ts.flattenDiagnosticMessageText(error.messageText, "\n");
    assert.doesNotMatch(
      message,
      /Expected \d+ arguments|incompatibleResourceOutput/,
      name,
    );
    for (const pattern of patterns)
      assert.match(message, pattern, `${name}: ${message}`);
    // Point at the resource supplied by the developer, rather than its options.
    const start =
      error.start! - error.file!.getPositionOfLineAndCharacter(line, 0);
    const argument = source[line].slice(start, start + error.length!);
    assert.match(
      argument,
      /StringStock|MissingName|NumberStock|Status|defineResource/,
      name,
    );
  }
});
