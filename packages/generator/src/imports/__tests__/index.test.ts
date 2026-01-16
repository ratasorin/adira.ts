import {
  createTestProgram,
  createTypeNodeTestProgram,
  getSymbolsName,
  has,
  printSymbols,
} from "../../utils/tests";

describe("SymbolCollector - Basic Scenarios", () => {
  test("1. Direct Link: properties in same file", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/src/index.d.ts": `
          export interface Profile { name: string }
          export interface User { profile: Profile }
        `,
      },
      ["User"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(getSymbolsName(set)).toEqual(new Set(["User", "Profile"]));
  });

  test("2. File Alias: imports from another file", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/src/other.d.ts": `export interface Item { id: number }`,
        "/src/index.d.ts": `
          import { Item } from './other';
          export interface Box { item: Item }
        `,
      },
      ["Box"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(getSymbolsName(set)).toEqual(new Set(["Box", "Item"]));
  });

  test("3. Transitive Alias: A -> ... -> C", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/src/c.d.ts": `export interface CCore { val: boolean }`,
        "/src/b.d.ts": `export { CCore as BCore } from './c';`,
        "/src/index.d.ts": `
          import { BCore as Core } from './b';
          export interface App { core: Core }
        `,
      },
      ["App"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(getSymbolsName(set)).toEqual(
      new Set(["App", "CCore", "Core", "BCore"]),
    );
  });

  test("4. Heritage: extends interface", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",

      {
        "/src/index.d.ts": `
          interface Base { id: string }
          export interface User extends Base { name: string }
        `,
      },
      ["User"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(getSymbolsName(set)).toEqual(new Set(["User", "Base"]));
  });

  test("5. Blacklisted Dependency: explicit exclusion", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",

      {
        "/node_modules/bad-lib/package.json": `{"name": "bad-lib"}`,
        "/node_modules/bad-lib/index.d.ts": `export interface Bad {}`,
        "/src/index.d.ts": `
          import { Bad } from 'bad-lib';
          export interface User { b: Bad }
        `,
      },
      ["User"],
      [], // empty whitelist
    );

    const set = collector.collectFromSymbols(symbols);
    expect(getSymbolsName(set)).toEqual(new Set(["User"]));
    expect(has(set, "Bad")).toBe(false);
  });

  test("6. Whitelisted Dependency: explicit inclusion", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/node_modules/good-lib/package.json": `{"name": "good-lib"}`,
        "/node_modules/good-lib/index.d.ts": `export interface Good {}`,
        "/src/index.d.ts": `
          import { Good } from 'good-lib';
          export interface User { g: Good }
        `,
      },
      ["User"],
      ["good-lib"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(getSymbolsName(set)).toEqual(new Set(["User", "Good"]));
  });

  test("7. External Boundary: whitelisted but don't crawl deep", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/node_modules/good-lib/package.json": `{"name": "good-lib"}`,
        "/node_modules/good-lib/index.d.ts": `
          export interface Deep {}
          export interface Good { d: Deep }
        `,
        "/src/index.d.ts": `
          import { Good } from 'good-lib';
          export interface User { g: Good }
        `,
      },
      ["User"],
      ["good-lib"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(getSymbolsName(set)).toEqual(new Set(["User", "Good"]));
    expect(has(set, "Deep")).toBe(false);
  });

  test("8. Partial Infection: Mix of good and bad props", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/node_modules/bad-lib/package.json": `{"name": "bad-lib"}`,
        "/node_modules/bad-lib/index.d.ts": `export interface Bad {}`,
        "/src/index.d.ts": `
          import { Bad } from 'bad-lib';
          interface GoodProp {}
          export interface User {
            a: GoodProp;
            b: Bad;
          }
        `,
      },
      ["User"],
      [],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(getSymbolsName(set)).toEqual(new Set(["User", "GoodProp"]));
    expect(has(set, "Bad")).toBe(false);
  });

  test("9. Basic Generic: Array<T>", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/src/index.d.ts": `
          interface Item {}
          export interface List { items: Array<Item> }
        `,
      },
      ["List"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(getSymbolsName(set)).toEqual(new Set(["List", "Item"]));
  });

  test("10. Function Signature: Arguments and Return", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/src/index.d.ts": `
          interface Input {}
          interface Output {}
          export interface API {
            process(i: Input): Output;
          }
        `,
      },
      ["API"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(getSymbolsName(set)).toEqual(new Set(["API", "Input", "Output"]));
  });
});

describe("SymbolCollector - Complex Scenarios", () => {
  test("11. Qualified Namespace: Passive Climb", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/index.d.ts": `
          namespace Level1 {
            export namespace Level2 {
              export interface Target {}
            }
          }
          export interface Root { ref: Level1.Level2.Target }
        `,
      },
      ["Root"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(has(set, "Target")).toBe(true);
    expect(has(set, "Level2")).toBe(true);
    expect(has(set, "Level1")).toBe(true);
  });

  test("12. Circular Dependency: A -> B -> A", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/a.d.ts": `import { B } from './b'; export interface A { b: B }`,
        "/b.d.ts": `import { A } from './a'; export interface B { a: A }`,
      },
      ["A"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(has(set, "A")).toBe(true);
    expect(has(set, "B")).toBe(true);
  });

  test("13. Value-as-Type (typeof const)", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/index.d.ts": `
          export declare const Config = { port: 3000 };
          export type AppConfig = typeof Config;
        `,
      },
      ["AppConfig"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(has(set, "Config")).toBe(true);
  });

  test("14. Mapped Types (keyof)", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/index.d.ts": `
          interface Dictionary { id: number }
          export type MapX = { [K in keyof Dictionary]: Dictionary[K] }
        `,
      },
      ["MapX"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(has(set, "Dictionary")).toBe(true);
  });

  test("15. Whitelisted Namespace Import", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/node_modules/good-lib/package.json": `{"name": "good-lib"}`,
        "/node_modules/good-lib/index.d.ts": `export interface Item {}`,
        "/index.d.ts": `
          import * as Lib from 'good-lib';
          export interface User { item: Lib.Item }
        `,
      },
      ["User"],
      ["good-lib"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(getSymbolsName(set)).toEqual(new Set(["User", "Item", "Lib"]));
  });

  test("16. Intersection with Blacklisted", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/node_modules/bad-lib/package.json": `{"name": "bad-lib"}`,
        "/node_modules/bad-lib/index.d.ts": `export interface Bad {}`,
        "/index.d.ts": `
          import { Bad } from 'bad-lib';
          interface Good {}
          export type Mixed = Good & Bad;
        `,
      },
      ["Mixed"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(has(set, "Good")).toBe(true);
    expect(has(set, "Bad")).toBe(false);
  });

  test("17. Default Import", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/def.d.ts": `export default interface MyDefault {}`,
        "/index.d.ts": `
          import MyDefault from './def';
          export interface User { d: MyDefault }
        `,
      },
      ["User"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(getSymbolsName(set)).toEqual(
      new Set(["User", "MyDefault", "default"]),
    );
  });

  test("18. Class Static Property Access", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/index.d.ts": `
          class Config { static readonly TIMEOUT = 1000; }
          export type Timeout = typeof Config.TIMEOUT;
        `,
      },
      ["Timeout"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(has(set, "Config")).toBe(true);
    expect(has(set, "TIMEOUT")).toBe(true);
  });

  test("19. Deep Nested Generics", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/index.d.ts": `
          interface User {}
          interface Key {}
          export interface Cache {
            data: Promise<Map<Key, Array<User>>>
          }
        `,
      },
      ["Cache"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(has(set, "User")).toBe(true);
    expect(has(set, "Key")).toBe(true);
  });

  test("20. Enum Member Access", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/index.d.ts": `
          enum Roles { ADMIN }
          export interface User { role: Roles.ADMIN }
        `,
      },
      ["User"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(has(set, "Roles")).toBe(true);
    expect(has(set, "ADMIN")).toBe(true);
  });

  test.only("21. Start from Type Arguments", () => {
    const { collector, typeNode } = createTypeNodeTestProgram(
      "src/imports/__tests__",
      {
        "/models/Tag.ts": `
          export interface ITag { id: string; name: string; }
        `,
        "/models/Category.ts": `
          import { ITag } from './Tag';
          import { RefTo } from '@n/adira.core.ts';
          export interface ICategory { id: string; tags: string & RefTo<ITag>; name: string; }
        `,
        "/node_modules/@n/adira.core.ts/index.d.ts": `
          export namespace Backend {
            export type InferHandlerParams<T> = T extends (req: infer R, res: infer S) => any ? R : never;
            export type ExecuteGET<T, Q> = (params: T, query: Q) => Promise<any>;
          }
          export type RefTo<T> = T extends { id: infer I } ? I : never;
        `,
        "/node_modules/@n/adira.core.ts/package.json": `{"name": "@n/adira.core.ts"}`,
        "/index.d.ts": `
          import { Backend } from '@n/adira.core.ts';
          import { ICategory } from './models/Category';

          declare const getUsers: Backend.ExecuteGET<ICategory, {}>;
          type GetUsersFn = typeof getUsers;
          export declare const getUsersHandler = (req: Request<any, any, any, Backend.InferHandlerParams<GetUsersFn>>, res: any) => Promise<void>;
        `,
      },
      "Backend.InferHandlerParams<GetUsersFn>",
      ["@n/adira.core.ts"],
    );

    const set = collector.collectFromNodes(new Set([typeNode]));
    console.log([...set].map((s) => s.name));
    expect(has(set, "Backend")).toBe(true);
    expect(has(set, "ICategory")).toBe(true);
    expect(has(set, "ITag")).toBe(true);
    expect(has(set, "RefTo")).toBe(true);
  });

  test("22. Handle Inline Imports", () => {
    const { collector, symbols } = createTestProgram(
      "src/imports/__tests__",
      {
        "/node_modules/good-import/index.d.ts": `
        export type GoodImport = { id: string; name: string; };
      `,
        "/node_modules/good-import/package.json": `{"name": "good-import"}`,
        "/index.d.ts": `
        export interface IGoodImportWrapper {
          goodImport: import('good-import').GoodImport;
        }
      `,
      },
      ["IGoodImportWrapper"],
      ["good-import"],
    );

    const set = collector.collectFromSymbols(symbols);
    expect(has(set, "GoodImport")).toBe(true);
    expect(has(set, "IGoodImportWrapper")).toBe(true);
  });
});
