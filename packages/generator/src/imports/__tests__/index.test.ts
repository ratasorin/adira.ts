import { createTestProgram, getSymbols, has, printSymbols } from "./utils";

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

  test.only("2. File Alias: imports from another file", () => {
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

    expect(getSymbols(set)).toEqual(new Set(["App", "CCore", "Core", "BCore"]));
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

describe("SymbolCollector - Complex Scenarios", () => {
  test("11. Qualified Namespace: Passive Climb", () => {
    const { collector } = createTestProgram({
      "/index.ts": `
        namespace Level1 {
          export namespace Level2 {
             export interface Target {}
          }
        }
        export interface Root { ref: Level1.Level2.Target }
      `,
    });
    const set = collector.collect(["Root"]);
    expect(has(set, "Target")).toBe(true);
    expect(has(set, "Level2")).toBe(true); // Passive
    expect(has(set, "Level1")).toBe(true); // Passive
  });

  test("12. Circular Dependency: A -> B -> A", () => {
    const { collector } = createTestProgram({
      "/a.ts": `import { B } from './b'; export interface A { b: B }`,
      "/b.ts": `import { A } from './a'; export interface B { a: A }`,
    });
    // Should not hang/crash
    const set = collector.collect(["A"]);
    expect(has(set, "A")).toBe(true);
    expect(has(set, "B")).toBe(true);
  });

  test("13. Value-as-Type (typeof const)", () => {
    const { collector } = createTestProgram({
      "/index.d.ts": `
        export declare const Config = { port: 3000 };
        export type AppConfig = typeof Config;
      `,
    });
    const set = collector.collect(["AppConfig"]);
    printSymbols(set);
    expect(has(set, "Config")).toBe(true); // Must find the variable symbol
  });

  test("14. Mapped Types (keyof)", () => {
    const { collector } = createTestProgram({
      "/index.ts": `
        interface Dictionary { id: number }
        export type MapX = { [K in keyof Dictionary]: Dictionary[K] }
      `,
    });
    const set = collector.collect(["MapX"]);
    expect(has(set, "Dictionary")).toBe(true);
  });

  test("15. Whitelisted Namespace Import", () => {
    const { collector } = createTestProgram(
      {
        "/node_modules/good-lib/package.json": `{"name": "good-lib"}`,
        "/node_modules/good-lib/index.d.ts": `export interface Item {}`,
        "/index.ts": `
        import * as Lib from 'good-lib';
        export interface User { item: Lib.Item }
      `,
      },
      ["good-lib"],
    );

    const set = collector.collect(["User"]);
    printSymbols(set);
    expect(getSymbols(set)).toEqual(new Set(["User", "Item", "Lib"]));
  });

  test("16. Intersection with Blacklisted", () => {
    const { collector } = createTestProgram(
      {
        "/node_modules/bad-lib/package.json": `{"name": "bad-lib"}`,
        "/node_modules/bad-lib/index.d.ts": `export interface Bad {}`,
        "/index.ts": `
        import { Bad } from 'bad-lib';
        interface Good {}
        export type Mixed = Good & Bad;
      `,
      },
      [],
    );
    const set = collector.collect(["Mixed"]);
    printSymbols(set);
    expect(has(set, "Good")).toBe(true);
    expect(has(set, "Bad")).toBe(false);
  });

  test("17. Default Import", () => {
    const { collector } = createTestProgram({
      "/def.ts": `export default interface MyDefault {}`,
      "/index.ts": `
        import MyDefault from './def';
        export interface User { d: MyDefault }
      `,
    });
    const set = collector.collect(["User"]);
    expect(getSymbols(set)).toEqual(new Set(["User", "MyDefault", "default"]));
  });

  test("18. Class Static Property Access", () => {
    const { collector } = createTestProgram({
      "/index.ts": `
        class Config { static readonly TIMEOUT = 1000; }
        export type Timeout = typeof Config.TIMEOUT;
      `,
    });
    const set = collector.collect(["Timeout"]);
    expect(has(set, "Config")).toBe(true); // Passive climb to class
    expect(has(set, "TIMEOUT")).toBe(true);
  });

  test("19. Deep Nested Generics", () => {
    const { collector } = createTestProgram({
      "/index.ts": `
        interface User {}
        interface Key {}
        export interface Cache { 
           data: Promise<Map<Key, Array<User>>> 
        }
      `,
    });
    const set = collector.collect(["Cache"]);
    expect(has(set, "User")).toBe(true);
    expect(has(set, "Key")).toBe(true);
    // Promise, Map, Array are built-ins, usually not in keepSet unless explicitly local,
    // but the crawler should traverse them.
  });

  test("20. Enum Member Access", () => {
    const { collector } = createTestProgram({
      "/index.ts": `
        enum Roles { ADMIN }
        export interface User { role: Roles.ADMIN }
      `,
    });
    const set = collector.collect(["User"]);
    expect(has(set, "Roles")).toBe(true); // Passive
    expect(has(set, "ADMIN")).toBe(true);
  });
});
