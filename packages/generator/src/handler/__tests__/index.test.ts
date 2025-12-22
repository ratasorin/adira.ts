import * as fs from "node:fs";
import * as path from "node:path";
import { DiscoveredHandler } from "../types";
import { generateApiDefinitonForHandlers } from "../generate";
import ts from "typescript";
import { DependencyResolver } from "../../utils";
import { ImportCollector } from "../../imports/collector";

// --- Mock the Config Loader ---
// We mock this so we can control the whitelist without external files
jest.mock("../../config", () => ({
  loadConfig: () => ({
    allowedDependencies: ["@allowed/package", "@n/adira.core.ts"],
  }),
}));

/**
 * Creates a real TS Program from a set of virtual files on disk
 */
function createTestProgram(projectDir: string): ts.Program {
  let options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
    skipLibCheck: true,
    declaration: true,
  };

  // Get all .ts files in the temp dir
  const walk = (dir: string): string[] => {
    const files = fs.readdirSync(dir);
    return files.flatMap((file) => {
      const p = path.join(dir, file);
      return fs.statSync(p).isDirectory() ? walk(p) : p;
    });
  };

  const fileNames = walk(projectDir).filter((f) => f.endsWith(".ts"));
  return ts.createProgram(fileNames, options);
}

// --- Test Utilities ---
const TEMP_DIR = path.join(__dirname, "dist");

beforeAll(() => {
  if (fs.existsSync(TEMP_DIR))
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);
});
/**
 * Main Test Runner: Simulates the Generator Lifecycle
 */
async function runProjectTest(
  fileStructure: Record<string, string>,
  entryPointRelativePath: string,
  handlerName = "handler",
) {
  const testId = Math.random().toString(36).substring(7);
  const projectDir = path.join(TEMP_DIR, testId);
  const sharedSrcDir = path.join(projectDir, "shared/src");

  // 1. Write Source Files
  for (const [relativePath, content] of Object.entries(fileStructure)) {
    const fullPath = path.join(projectDir, "src", relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  // 2. Create Phase A Program (Source)
  const sourceProgram = createTestProgram(path.join(projectDir, "src"));

  const emittedFiles: string[] = [];
  // 3. Simulate "The Bridge" (Transpilation)
  // In a real test, you'd call your compileProject helper.
  // Here we simulate the .d.ts result for brevity or use the compiler API.
  const emitResult = sourceProgram.emit(
    undefined,
    (fileName, data) => {
      const rel = path.relative(path.join(projectDir, "src"), fileName);
      const outPath = path.join(sharedSrcDir, rel);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, data);
      emittedFiles.push(outPath); // Track exactly what was created
    },
    undefined,
    true, // true = emitOnlyDts
  );

  // 4. Create Phase B Program using the EXPLICIT emitted file list
  const program = ts.createProgram({
    rootNames: emittedFiles,
    options: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      baseUrl: sharedSrcDir,
      skipLibCheck: true,
      allowJs: false,
      declaration: true,
      emitDeclarationOnly: true,
    },
  });

  // Verify the program loaded the files
  const handlerDtsPath = path.join(
    sharedSrcDir,
    entryPointRelativePath.replace(".ts", ".d.ts"),
  );
  if (!program.getSourceFile(handlerDtsPath)) {
    // Debug: log all files actually loaded
    console.log(
      "Loaded files:",
      program.getSourceFiles().map((f) => f.fileName),
    );
    throw new Error(`Failed to load declaration file: ${handlerDtsPath}`);
  }

  const resolver = new DependencyResolver(program, [
    "@allowed/package",
    "@n/adira.core.ts",
  ]);
  const collector = new ImportCollector(program, resolver, sharedSrcDir);

  const handler: DiscoveredHandler = {
    method: "POST" as any,
    endpoint: "/test",
    endpointPrefix: "/api",
    handler: {
      name: handlerName,
      sourcePath: path.join(
        sharedSrcDir,
        entryPointRelativePath.replace(".ts", ".d.ts"),
      ),
    },
  };

  const api = await generateApiDefinitonForHandlers(
    [handler],
    program,
    collector,
  );

  return {
    api,
    imports: collector.getImportLines(),
  };
}

describe("Semantic Type Generator", () => {
  test("Scenario 1: Resolves Primitives and Literals correctly", async () => {
    // We define a Dummy Request type structure that matches what your code expects:
    // Req<Params, Res, Body, Query> -> Indices: 0=Params, 2=Body, 3=Query
    const code = `
      export type Req<P, R, B, Q> = { p: P, b: B, q: Q };
      
      export const handler = (
        req: Req<
          { id: string },           // Params (Index 0)
          {},                       
          { count: 10 | 20 },       // Body (Index 2)
          { active: boolean }       // Query (Index 3)
        >, 
        res: any
      ) => {};
    `;

    const files = {
      "handlers/test.ts": code,
    };

    const { api } = await runProjectTest(files, "handlers/test.ts", "handler");
    const result = api["/api/test"]["POST"];

    // Check Params (Simple Object)
    expect(result.RequestParams).toContain("id: string");

    // Check Body (Union Literal)
    expect(result.RequestBody).toBe("{ count: 10 | 20 }");

    // Check Query (Primitive)
    expect(result.RequestQuery).toBe("{ active: boolean }");
  });

  test("Scenario 2: Unwraps 'Serialize' utility types", async () => {
    // Your code has logic: if typeName.endsWith("Serialize"), use 2nd argument
    const code = `
      type Serialize<Internal, Public> = Public;
      
      interface DBUser { _id: number; password_hash: string; }
      interface APIUser { id: string; }

      export type Req<P, R, B, Q> = { b: B };

      export const handler = (
        req: Req<{}, {}, Serialize<DBUser, APIUser>, {}>, 
        res: any
      ) => {};
    `;

    const files = {
      "handlers/test.ts": code,
    };

    const { api } = await runProjectTest(files, "handlers/test.ts", "handler");
    const bodyType = api["/api/test"]["POST"];

    // It should ONLY see the APIUser structure
    expect(bodyType.RequestBody).toContain("APIUser");
  });

  test("Scenario 3: Extracts Local Interfaces into Definitions", async () => {
    const code = `
      export interface UserProfile {
        username: string;
        age?: number;
      }
      
      export type Req<P, R, B, Q> = { b: B };

      export const handler = (
        req: Req<{}, {}, UserProfile, {}>, 
        res: any
      ) => {};
    `;

    const files = {
      "handlers/test.ts": code,
    };

    const { api, imports } = await runProjectTest(
      files,
      "handlers/test.ts",
      "handler",
    );

    // 1. The Body string should reference the interface name, not the literal
    expect(api["/api/test"]["POST"].RequestBody).toBe("UserProfile");

    expect(imports).toContain("UserProfile");
  });

  test("Scenario 4: Handles Arrays and Nested Objects", async () => {
    const code = `
      export type Req<P, R, B, Q> = { b: B };

      export const handler = (
        req: Req<{}, {}, { tags: string[]; meta: { created: boolean } }, {}>, 
        res: any
      ) => {};
    `;

    const files = {
      "handlers/test.ts": code,
    };

    const { api } = await runProjectTest(files, "handlers/test.ts", "handler");
    const body = api["/api/test"]["POST"].RequestBody;

    expect(body).toBe("{ tags: string[]; meta: { created: boolean } }");
  });

  test("Scenario 5: External Whitelist Handling", async () => {
    // This creates a fake 'node_modules' setup is hard in a single file test.
    // Instead, we will simulate the behavior by defining a type that *looks* like
    // it was imported, or rely on the logic that "Unknown External -> Any".

    // Let's test the Fallback to Any first (Security check)
    // We use 'Date' or 'Buffer' - usually treated as externals/globals
    const code = `
      import fs from "fs"; // Native node module, definitely not whitelisted
      export type Req<P, R, B, Q> = { b: B };

      export const handler = (
        req: Req<{}, {}, { file: fs.Stats }, {}>, 
        res: any
      ) => {};
    `;

    const files = {
      "/handlers/test.ts": code,
    };

    const { api } = await runProjectTest(files, "handlers/test.ts", "handler");
    const body = api["/api/test"]["POST"].RequestBody;

    // fs.Stats should be resolved to 'any' because 'fs' is not in our mocked allowedDependencies
    // However, since we can't easily mock actual node_resolution in this temp dir without `npm install`,
    // TypeScript might just fail to resolve 'fs' and return 'any' anyway.
    // A better test is checking if the output contains "fs.Stats".
    expect(body).toContain("file: any");
  });
});

describe("Multi-File Dependency Resolution", () => {
  test("1. Imports Local Interface from another file", async () => {
    // Structure: Controller imports User from models.ts
    const files = {
      "models.ts": `
        export interface User {
          id: string;
          email: string;
        }
      `,
      "controller.ts": `
        import { User } from "./models";
        
        // Helper to match your extractor structure
        export type Req<P, R, B, Q> = { b: B }; 

        export const handler = (
          req: Req<{}, {}, User, {}>, 
          res: any
        ) => {};
      `,
    };

    const { api, imports } = await runProjectTest(files, "controller.ts");

    // 1. Validates that the body type refers to "User" (the name)
    expect(api["/api/test"]["POST"].RequestBody).toBe("User");

    // 2. Validates that the definition for "User" was found in the other file and extracted
    expect(imports).toContain("User");
  });

  test("2. Handles Deep Nested Imports (Grandchild dependencies)", async () => {
    // Structure: Controller -> DTOs -> Enums
    const files = {
      "enums.ts": `
        export type Status = "active" | "banned";
      `,
      "dtos.ts": `
        import { Status } from "./enums";
        export interface UpdatePayload {
          status: Status;
        }
      `,
      "controller.ts": `
        import { UpdatePayload } from "./dtos";
        
        export type Req<P, R, B, Q> = { b: B }; 

        export const handler = (
          req: Req<{}, {}, UpdatePayload, {}>, 
          res: any
        ) => {};
      `,
    };

    const { imports } = await runProjectTest(files, "controller.ts");

    // It should define UpdatePayload
    expect(imports).toContain("UpdatePayload");
  });

  test("3. Simulates 'node_modules' Whitelist Behavior", async () => {
    /* This is a tricky test. We create a folder named 'node_modules' 
       inside our temp directory. TypeScript resolution usually defaults 
       to looking for this folder name.
       
       We want to prove that:
       1. "legacy-types" (whitelisted) -> Generating "import { X } from 'legacy-types'"
       2. "random-lib" (not whitelisted) -> Generating "any"
    */

    const files = {
      // --- Fake Node Module 1: Whitelisted ---
      "node_modules/@allowed/package/index.d.ts": `
        export interface User { id: number; }
      `,

      // --- Fake Node Module 2: Ignored ---
      "node_modules/random-lib/index.d.ts": `
        export interface SecretThing { secret: string; }
      `,

      // --- Our Code ---
      "controller.ts": `
        import { User } from "@allowed/package";
        import { SecretThing } from "random-lib";
        
        export type Req<P, R, B, Q> = { b: B }; 

        export const handler = (
          req: Req<{}, {}, { 
            user: User, 
            secret: Serializable<SecretThing, {__shh: string}> 
          }, {}>, 
          res: any
        ) => {};
      `,
    };

    const { api, imports } = await runProjectTest(files, "controller.ts");
    const bodyStr = api["/api/test"]["POST"].RequestBody;

    // 1. Check Whitelisted Import
    // Expect: user: LegacyUser
    expect(bodyStr).toContain("user: User");

    // 2. Check Blacklisted/Unknown Import
    // Expect: secret: any
    expect(bodyStr).toContain("secret: any");

    // 3. Check Generated Import Statements
    // It should generate an import for the whitelisted package
    const importBlock = imports.join("\n");
    expect(importBlock).toContain('import { User } from "@allowed/package";');
    expect(importBlock).not.toContain("random-lib");
  });
});

describe.only("Adira Library Dependency Resolution", () => {
  test("Reproduce: Local types missing when wrapped in Whitelisted Generics", async () => {
    // 1. Setup the file structure mimicking your real project
    const files = {
      "node_modules/@n/adira.core.ts/index.d.ts": `
        export namespace Backend {
          export type ExecuteGET<T> = (params: any) => Promise<T>;
          export type ExecutePOST<T> = (params: any, body: any) => Promise<T>;
          // We assume these helpers exist for the types to compile
          export type InferHandlerParams<T> = any;
          export type InferHandlerResponse<T, K> = T extends (args: any) => Promise<infer R> ? R : any;
        }
        export type Serialize<T, R> = T;
        export type RefTo<T> = T;
      `,
      "node_modules/@n/adira.core.ts/package.json": JSON.stringify({
        name: "@n/adira.core.ts",
        version: "1.0.0",
        main: "index.d.ts",
      }),
      "models/User.ts": `
        import { RefTo, Serialize } from "@n/adira.core.ts";
        import mongoose, { Schema, Document, Model } from "mongoose";
        import { IOrder } from "./Order";

        export interface IUser {
        _id: Serialize<mongoose.Types.ObjectId, string>;
        name: string;
        email: string;
        createdAt: Date;
        deletedAt?: Date;
        orders?: (Serialize<mongoose.Types.ObjectId, string> & RefTo<IOrder>)[]; // References to Orders
        }

        const UserSchema: Schema<IUser & Document> = new Schema({
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        createdAt: { type: Date, default: Date.now },
        deletedAt: { type: Date, default: null },
        });

        const User: Model<IUser & Document> = mongoose.model<IUser & Document>(
        "User",
        UserSchema,
        );

        export default User;`,

      "models/Category.ts": `
        import mongoose, { Schema, Document, Model } from "mongoose";
        import { IUser } from "./User";
        import { RefTo, Serialize } from "@n/adira.core.ts";

        export interface ICategory {
        _id: Serialize<mongoose.Types.ObjectId, string>;
        name: string;
        description: string;
        slug: string;
        parentCategory: Serialize<mongoose.Types.ObjectId, string> & RefTo<ICategory>;
        createdBy: Serialize<mongoose.Types.ObjectId, string> & RefTo<IUser>;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        deletedAt?: Date;
        }

        const CategorySchema: Schema<ICategory & Document> = new Schema({
        name: { type: String, required: true, unique: true },
        description: { type: String },
        slug: { type: String, required: true, unique: true },
        parentCategory: { type: Schema.Types.ObjectId, ref: "Category" },
        isActive: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        deletedAt: { type: Date, default: null },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        });

        CategorySchema.pre("save", function (next) {
        this.updatedAt = new Date();
        next();
        });

        // Index for efficient queries
        CategorySchema.index({ slug: 1 });
        CategorySchema.index({ parentCategory: 1 });

        const Category: Model<ICategory & Document> = mongoose.model<
        ICategory & Document
        >("Category", CategorySchema);

        export default Category;
      `,

      "types.ts": `
        export interface ErrorResponse {
          error: boolean;
          message: string;
        }
      `,

      "controller/categories.ts": `
        import { Backend } from "@n/adira.core.ts";
        import { ICategory } from "../models/Category";
        import { ErrorResponse } from "../types";
        import type {Request, Response} from 'express';

        export type GetCategoriesFn = Backend.ExecuteGET<ICategory>;
        export type CreateCategoryFn = Backend.ExecutePOST<ICategory>;

        export const handler = (
          req: Request<any, any, any, Backend.InferHandlerParams<GetCategoriesFn>>, 
          res: Response<Backend.InferHandlerResponse<GetCategoriesFn, {}> | ErrorResponse>)
        ) => {
            res.send({error: true, message: "Unimplemented method!" });
         };
      `,
    };

    const { api, imports } = await runProjectTest(
      files,
      "controller/categories.ts",
    );

    const apiDefinition = api["/api/test"]["POST"];
    const query = apiDefinition.RequestQuery;

    expect(query).toBe("Backend.InferHandlerParams<GetCategoriesFn>");
    console.log({ api, imports });
  });
});
