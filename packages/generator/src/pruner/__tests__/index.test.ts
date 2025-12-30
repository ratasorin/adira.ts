import { createTestProgram, getSymbolsName } from "../../utils/tests";
import { Pruner } from "..";
import fs from "fs";
import path from "path";

/**
 * Helper to run the collector, create the transformer, and emit the pruned files.
 */
function emitPruned(
  files: Record<string, string>,
  entryPointNames: string[],
  whitelistedPackageNames: string[] = [],
): Record<string, string> {
  const { program, collector, symbols } = createTestProgram(
    files,
    entryPointNames,
    whitelistedPackageNames,
  );

  const checker = program.getTypeChecker();
  // 1. Collect Symbols
  const allowedSymbols = collector.collect(symbols);

  // 2. Create Transformer
  const pruner = new Pruner(checker, allowedSymbols);

  // 3. Emit with Transformer
  const outputs: Record<string, string> = {};

  const compilerOptions = program.getCompilerOptions();
  const projectRoot = compilerOptions.baseUrl || process.cwd();

  for (const sourceFile of program.getSourceFiles()) {
    if (
      program.isSourceFileFromExternalLibrary(sourceFile) ||
      program.isSourceFileDefaultLibrary(sourceFile)
    )
      continue;

    // We process .d.ts files (or .d.ts files if testing locally)
    // Note: If you renamed input to .d.ts, this still works fine.
    if (!sourceFile.isDeclarationFile && !sourceFile.fileName.endsWith(".d.ts"))
      continue;

    // A. Modify the file on disk (or delete it)
    pruner.save(sourceFile);

    // B. Calculate Relative Path dynamically
    const relPath = path.relative(projectRoot, sourceFile.fileName);

    // Normalize to your input format (e.g., "/src/index.d.ts")
    const key = "/" + relPath.split(path.sep).join("/");

    // C. Read file
    if (fs.existsSync(sourceFile.fileName)) {
      outputs[key] = fs.readFileSync(sourceFile.fileName, "utf-8");
    } else {
      // File was deleted
      outputs[key] = ""; // or undefined, depending on how you want to assert "deleted"
    }
  }

  return outputs;
}

/**
 * Normalizes output for comparison (strips newlines/whitespace differences)
 */
const normalize = (str?: string) => str?.replace(/\s+/g, " ").trim();

describe("Pruner - Tree Shaking Scenarios", () => {
  test("1. Direct Link: prunes unused const declarations", () => {
    // Junk: Unused const
    const outputs = emitPruned(
      {
        "/src/index.d.ts": `
            export interface Profile { name: string }
            export interface User { profile: Profile }
            
            export declare const UnusedConst: "I should be deleted"; 
          `,
      },
      ["User"],
    );

    const content = normalize(outputs["/src/index.d.ts"]);
    expect(content).toContain("interface Profile");
    expect(content).toContain("interface User");
    expect(content).not.toContain("UnusedConst");
  });

  test("2. File Alias: prunes unused imports", () => {
    // Junk: Unused import
    const outputs = emitPruned(
      {
        "/src/other.d.ts": `export interface Item { id: number }`,
        "/src/index.d.ts": `
            import { Item } from './other';
            import { Unused } from './other'; // This should be pruned (if it existed)
            export interface Box { item: Item }
          `,
      },
      ["Box"],
    );

    const content = normalize(outputs["/src/index.d.ts"]);
    expect(content).toContain("import { Item } from './other'");
    expect(content).toContain("interface Box");
    // The import statement for Unused should be cleaned up or the specifier removed
    expect(content).not.toContain("Unused");
  });

  test("3. Transitive Alias: prunes unused re-exports", () => {
    // Junk: Unused Type Alias
    const outputs = emitPruned(
      {
        "/src/c.d.ts": `export interface CCore { val: boolean }`,
        "/src/b.d.ts": `
        export { CCore as BCore } from './c';
        export type UnusedAlias = string; 
      `,
        "/src/index.d.ts": `
            import { BCore as Core } from './b';
            export interface App { core: Core }
          `,
      },
      ["App"],
    );

    // Check b.d.ts
    const bContent = normalize(outputs["/src/b.d.ts"]);
    expect(bContent).toContain("export { CCore as BCore } from './c'");
    expect(bContent).not.toContain("UnusedAlias");
  });

  test("4. Heritage: prunes unused interface with inheritance", () => {
    // Junk: Interface with inheritance
    const outputs = emitPruned(
      {
        "/src/index.d.ts": `
            interface Base { id: string }
            export interface User extends Base { name: string }
            
            interface UnusedBase {}
            interface UnusedChild extends UnusedBase {}
          `,
      },
      ["User"],
    );

    const content = normalize(outputs["/src/index.d.ts"]);
    expect(content).toContain("interface Base");
    expect(content).toContain("interface User");
    expect(content).not.toContain("UnusedBase");
    expect(content).not.toContain("UnusedChild");
  });

  test("5. Blacklisted Dependency: prunes import of blacklisted item", () => {
    // Junk: Class declaration
    const outputs = emitPruned(
      {
        "/node_modules/bad-lib/package.json": `{"name": "bad-lib"}`,
        "/node_modules/bad-lib/index.d.ts": `export interface Bad { }`,
        "/src/index.d.ts": `
            import { Bad } from 'bad-lib';
            export interface User { b: Bad }
            
            export class UnusedClass {}
          `,
      },
      ["User"],
      [], // Empty whitelist
    );

    const content = normalize(outputs["/src/index.d.ts"]);
    expect(content).toContain("interface User");
    expect(content).not.toContain("UnusedClass");

    // Since 'Bad' is blacklisted, the import should be pruned
    expect(content).not.toContain("import { Bad }");
  });

  test("6. Whitelisted Dependency: prunes unused classes with inheritance", () => {
    // Junk: Class with inheritance
    const outputs = emitPruned(
      {
        "/node_modules/good-lib/package.json": `{"name": "good-lib"}`,
        "/node_modules/good-lib/index.d.ts": `export interface Good { }`,
        "/src/index.d.ts": `
            import { Good } from 'good-lib';
            export interface User { g: Good }

            class UnusedParent {}
            class UnusedChild extends UnusedParent {}
          `,
      },
      ["User"],
      ["good-lib"],
    );

    const content = normalize(outputs["/src/index.d.ts"]);
    expect(content).toContain("interface User");
    expect(content).toContain("import { Good }");
    expect(content).not.toContain("UnusedParent");
    expect(content).not.toContain("UnusedChild");
  });

  test("7. External Boundary: prunes unused multiple inheritance", () => {
    // Junk: Multiple Inheritance interface
    const outputs = emitPruned(
      {
        "/node_modules/good-lib/package.json": `{"name": "good-lib"}`,
        "/node_modules/good-lib/index.d.ts": `
            export interface Deep { }
            export interface Good { d: Deep } 
          `,
        "/src/index.d.ts": `
            import { Good } from 'good-lib';
            export interface User { g: Good }
            
            interface A {}
            interface B {}
            interface UnusedPoly extends A, B {}
          `,
      },
      ["User"],
      ["good-lib"],
    );

    const content = normalize(outputs["/src/index.d.ts"]);
    expect(content).toContain("interface User");
    expect(content).not.toContain("UnusedPoly");
  });

  test("8. Partial Infection: prunes unused type alias to anonymous object", () => {
    // Junk: Type Alias to Anonymous Object
    const outputs = emitPruned(
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
            
            type UnusedObj = { x: number, y: number };
          `,
      },
      ["User"],
      [],
    );

    const content = normalize(outputs["/src/index.d.ts"]);
    expect(content).toContain("interface User");
    expect(content).toContain("interface GoodProp");
    expect(content).not.toContain("UnusedObj");
  });

  test("9. Basic Generic: prunes unused generic interface", () => {
    // Junk: Unused Generic Interface
    const outputs = emitPruned(
      {
        "/src/index.d.ts": `
            interface Item {}
            export interface List { items: Array<Item> }
            
            interface UnusedGen<T> { val: T }
          `,
      },
      ["List"],
    );

    const content = normalize(outputs["/src/index.d.ts"]);
    expect(content).toContain("interface Item");
    expect(content).toContain("interface List");
    expect(content).not.toContain("UnusedGen");
  });

  test("10. Function Signature: prunes unused function declaration", () => {
    // Junk: Function Declaration
    const outputs = emitPruned(
      {
        "/src/index.d.ts": `
            interface Input {}
            interface Output {}
            export interface API {
              process(i: Input): Output;
            }
            
            export function unusedFunc(a: string): void {}
          `,
      },
      ["API"],
    );

    const content = normalize(outputs["/src/index.d.ts"]);
    expect(content).toContain("interface API");
    expect(content).not.toContain("unusedFunc");
  });

  test("11. Qualified Namespace: prunes unused namespace", () => {
    // Junk: Unused Namespace
    const outputs = emitPruned(
      {
        "/index.d.ts": `
            namespace Level1 {
              export namespace Level2 {
                export interface Target {}
              }
            }
            export interface Root { ref: Level1.Level2.Target }
            
            namespace UnusedNS { export const X = 1; }
          `,
      },
      ["Root"],
    );

    const content = normalize(outputs["/index.d.ts"]);
    expect(content).toContain("namespace Level1");
    expect(content).not.toContain("UnusedNS");
  });

  test("12. Circular Dependency: prunes unused enum", () => {
    // Junk: Enum Declaration
    const outputs = emitPruned(
      {
        "/a.d.ts": `import { B } from './b'; export interface A { b: B }`,
        "/b.d.ts": `
        import { A } from './a'; 
        export interface B { a: A }
        export enum UnusedEnum { A, B }
      `,
      },
      ["A"],
    );

    const bContent = normalize(outputs["/b.d.ts"]);
    expect(bContent).toContain("interface B");
    expect(bContent).not.toContain("UnusedEnum");
  });

  test("13. Value-as-Type: prunes unused var in value-as-type context", () => {
    // Junk: Unused variable that looks like a config
    const outputs = emitPruned(
      {
        "/index.d.ts": `
            export declare const Config = { port: 3000 };
            export type AppConfig = typeof Config;
            
            export const UnusedConfig = { host: 'localhost' };
          `,
      },
      ["AppConfig"],
    );

    const content = normalize(outputs["/index.d.ts"]);
    expect(content).toContain("const Config");
    expect(content).toContain("type AppConfig");
    expect(content).not.toContain("UnusedConfig");
  });

  test("14. Mapped Types: prunes unused type used in unused map", () => {
    // Junk: Mapped type using unused interface
    const outputs = emitPruned(
      {
        "/index.d.ts": `
            interface Dictionary { id: number }
            export type MapX = { [K in keyof Dictionary]: Dictionary[K] }
            
            interface UnusedDict { k: string }
            type UnusedMap = { [K in keyof UnusedDict]: UnusedDict[K] }
          `,
      },
      ["MapX"],
    );

    const content = normalize(outputs["/index.d.ts"]);
    expect(content).toContain("interface Dictionary");
    expect(content).toContain("type MapX");
    expect(content).not.toContain("UnusedDict");
    expect(content).not.toContain("UnusedMap");
  });

  test("15. Whitelisted Namespace Import: prunes unused property in variable", () => {
    // Junk: Variable statement with multiple decls
    const outputs = emitPruned(
      {
        "/node_modules/good-lib/package.json": `{"name": "good-lib"}`,
        "/node_modules/good-lib/index.d.ts": `export interface Item {}`,
        "/index.d.ts": `
            import * as Lib from 'good-lib';
            export interface User { item: Lib.Item }
            
            export const X = 1, Y = 2; // Both unused
          `,
      },
      ["User"],
      ["good-lib"],
    );

    const content = normalize(outputs["/index.d.ts"]);
    expect(content).toContain("import * as Lib");
    expect(content).not.toContain("const X");
    expect(content).not.toContain("Y = 2");
  });

  test("16. Intersection with Blacklisted: prunes unused intersection", () => {
    // Junk: Unused Intersection
    const outputs = emitPruned(
      {
        "/node_modules/bad-lib/package.json": `{"name": "bad-lib"}`,
        "/node_modules/bad-lib/index.d.ts": `export interface Bad {}`,
        "/index.d.ts": `
            import { Bad } from 'bad-lib';
            interface Good {}
            export type Mixed = Good & Bad;
            
            type UnusedIntersection = Good & string;
          `,
      },
      ["Mixed"],
      [],
    );
    const content = normalize(outputs["/index.d.ts"]);
    expect(content).toContain("type Mixed");
    expect(content).not.toContain("UnusedIntersection");
  });

  test("17. Default Import: prunes unused default export assignment", () => {
    // Junk: Unused default export
    const outputs = emitPruned(
      {
        "/def.d.ts": `
          export default interface MyDefault {}
      `,
        "/unused.d.ts": `
          export default interface UnusedDefault {}
      `,
        "/index.d.ts": `
            import MyDefault from './def';
            import UnusedDefault from './unused';
            export interface User { d: MyDefault }
          `,
      },
      ["User"],
    );

    const indexContent = normalize(outputs["/index.d.ts"]);
    expect(indexContent).toContain("import MyDefault");
    expect(indexContent).not.toContain("UnusedDefault");
  });

  test("18. Class Static Property: prunes unused static member access", () => {
    // Junk: Unused class with static
    const outputs = emitPruned(
      {
        "/index.d.ts": `
            class Config { static readonly TIMEOUT = 1000; }
            export type Timeout = typeof Config.TIMEOUT;
            
            class UnusedConfig { static readonly VAL = 1; }
          `,
      },
      ["Timeout"],
    );

    const content = normalize(outputs["/index.d.ts"]);
    expect(content).toContain("class Config");
    expect(content).not.toContain("UnusedConfig");
  });

  test("19. Deep Nested Generics: prunes unused deeply nested generic", () => {
    // Junk: Complex Generic Type Alias
    const outputs = emitPruned(
      {
        "/index.d.ts": `
            interface User {}
            interface Key {}
            export interface Cache { 
              data: Promise<Map<Key, Array<User>>> 
            }
            
            type UnusedDeep<T> = Promise<Array<T>>;
          `,
      },
      ["Cache"],
    );

    const content = normalize(outputs["/index.d.ts"]);
    expect(content).toContain("interface User");
    expect(content).not.toContain("UnusedDeep");
  });

  test("20. Enum Member Access: prunes unused enum member usage", () => {
    // Junk: Unused Enum
    const outputs = emitPruned(
      {
        "/index.d.ts": `
            enum Roles { ADMIN }
            export interface User { role: Roles.ADMIN }
            
            enum UnusedRoles { GUEST }
          `,
      },
      ["User"],
    );

    const content = normalize(outputs["/index.d.ts"]);
    expect(content).toContain("enum Roles");
    expect(content).not.toContain("UnusedRoles");
  });
});
