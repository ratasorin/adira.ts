import { createTestProgram, getSymbols, has } from "./utils";

describe("SymbolCollector - Basic Scenarios", () => {
  test("1. Direct Link: properties in same file", () => {
    const { collector } = createTestProgram({
      "/src/index.ts": `
        export interface Profile { name: string }
        export interface User { profile: Profile }
      `,
    });
    const set = collector.collect(["User"]);

    expect(getSymbols(set)).toEqual(new Set(["User", "Profile"]));
  });

  test("2. File Alias: imports from another file", () => {
    const { collector } = createTestProgram({
      "/src/other.ts": `export interface Item { id: number }`,
      "/src/index.ts": `
        import { Item } from './other';
        export interface Box { item: Item }
      `,
    });
    const set = collector.collect(["Box"]);

    expect(getSymbols(set)).toEqual(new Set(["Box", "Item"]));
  });

  test("3. Transitive Alias: A -> ... -> C", () => {
    const { collector } = createTestProgram({
      "/src/c.ts": `export interface CCore { val: boolean }`,
      "/src/b.ts": `export { CCore as BCore } from './c';`, // Re-export
      "/src/index.ts": `
        import { BCore as Core } from './b';
        export interface App { core: Core }
      `,
    });
    const set = collector.collect(["App"]);

    expect(getSymbols(set)).toEqual(new Set(["App", "CCore"]));
  });

  test("4. Heritage: extends interface", () => {
    const { collector } = createTestProgram({
      "/src/index.ts": `
        interface Base { id: string }
        export interface User extends Base { name: string }
      `,
    });
    const set = collector.collect(["User"]);

    expect(getSymbols(set)).toEqual(new Set(["User", "Base"]));
  });

  test("5. Blacklisted Dependency: explicit exclusion", () => {
    const { collector } = createTestProgram(
      {
        "/node_modules/bad-lib/package.json": `{"name": "bad-lib"}`,
        "/node_modules/bad-lib/index.d.ts": `export interface Bad { }`,
        "/src/index.ts": `
        import { Bad } from 'bad-lib';
        export interface User { b: Bad }
      `,
      },
      [],
    ); // Empty whitelist
    const set = collector.collect(["User"]);

    expect(getSymbols(set)).toEqual(new Set(["User"]));
    expect(getSymbols(set)).not.toContain("Bad");
  });

  test("6. Whitelisted Dependency: explicit inclusion", () => {
    const { collector } = createTestProgram(
      {
        "/node_modules/good-lib/package.json": `{"name": "good-lib"}`,
        "/node_modules/good-lib/index.d.ts": `export interface Good { }`,
        "/src/index.ts": `
        import { Good } from 'good-lib';
        export interface User { g: Good }
      `,
      },
      ["good-lib"],
    ); // Whitelisted
    const set = collector.collect(["User"]);
    expect(getSymbols(set)).toEqual(new Set(["User", "Good"]));
  });

  test("7. External Boundary: whitelisted but don't crawl deep", () => {
    const { collector } = createTestProgram(
      {
        "/node_modules/good-lib/package.json": `{"name": "good-lib"}`,
        "/node_modules/good-lib/index.d.ts": `
        export interface Deep { }
        export interface Good { d: Deep } 
      `,
        "/src/index.ts": `
        import { Good } from 'good-lib';
        export interface User { g: Good }
      `,
      },
      ["good-lib"],
    );
    const set = collector.collect(["User"]);

    expect(getSymbols(set)).toEqual(new Set(["User", "Good"]));
    expect(has(set, "Deep")).toBe(false); // Should NOT crawl inside external lib
  });

  test("8. Partial Infection: Mix of good and bad props", () => {
    const { collector } = createTestProgram(
      {
        "/node_modules/bad-lib/package.json": `{"name": "bad-lib"}`,
        "/node_modules/bad-lib/index.d.ts": `export interface Bad {}`,
        "/src/index.ts": `
        import { Bad } from 'bad-lib';
        interface GoodProp {}
        export interface User { 
           a: GoodProp; 
           b: Bad; 
        }
      `,
      },
      [],
    );
    const set = collector.collect(["User"]);

    expect(getSymbols(set)).toEqual(new Set(["User", "GoodProp"]));
    expect(getSymbols(set)).not.toContain("Bad");
  });

  test("9. Basic Generic: Array<T>", () => {
    const { collector } = createTestProgram({
      "/src/index.ts": `
        interface Item {}
        export interface List { items: Array<Item> }
      `,
    });
    const set = collector.collect(["List"]);

    expect(getSymbols(set)).toEqual(new Set(["List", "Item"]));
  });

  test("10. Function Signature: Arguments and Return", () => {
    const { collector } = createTestProgram({
      "/src/index.ts": `
        interface Input {}
        interface Output {}
        export interface API {
          process(i: Input): Output;
        }
      `,
    });
    const set = collector.collect(["API"]);

    expect(getSymbols(set)).toEqual(new Set(["API", "Input", "Output"]));
  });
});
