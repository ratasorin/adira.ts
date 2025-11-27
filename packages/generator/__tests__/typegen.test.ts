import * as fs from "node:fs";
import * as path from "node:path";
import { generateTypes, SimpleTypeDefinition } from "../typegen";
import { DiscoveredRoute } from "../parser";

// --- Mock the Config Loader ---
// We mock this so we can control the whitelist without external files
jest.mock("../config", () => ({
  loadConfig: () => ({
    allowedDependencies: ["@allowed/package"],
  }),
}));

// --- Test Utilities ---
const TEMP_DIR = path.join(__dirname, "dist");

beforeAll(() => {
  if (fs.existsSync(TEMP_DIR))
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);
});

/**
 * Helper to write a virtual controller file and run the generator against it.
 */
async function runTestAgainstCode(code: string, handlerName = "handler") {
  const fileName = `test_${Date.now()}.ts`;
  const filePath = path.join(TEMP_DIR, fileName);

  // Write the file to disk so ts.createProgram can find it
  fs.writeFileSync(filePath, code);

  const route: DiscoveredRoute = {
    handler: {
      path: filePath,
      name: handlerName,
    },
    method: "POST",
    path: "/test",
    prefix: "/api",
  };

  try {
    const result = await generateTypes([route]);
    return result;
  } finally {
    // Optional: Clean up individual file immediately, or let afterAll do it
    fs.rmSync(filePath);
  }
}

/**
 * Creates a temporary folder with multiple files to simulate a real project.
 * @param fileStructure Object where keys are relative paths and values are file content
 * @param entryPoint The file that contains the handler (e.g., "controllers/user.ts")
 */
async function runProjectTest(
  fileStructure: Record<string, string>,
  entryPoint: string,
) {
  // 1. Create a unique folder for this specific test case
  const testId = Math.random().toString(36).substring(7);
  const projectDir = path.join(TEMP_DIR, testId);
  fs.mkdirSync(projectDir);

  // 2. Write all files to disk
  for (const [relativePath, content] of Object.entries(fileStructure)) {
    const fullPath = path.join(projectDir, relativePath);
    // Ensure nested directories exist (e.g., if path is "models/user.ts")
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  // 3. Construct the RouteMeta pointing to the entry file
  const route: DiscoveredRoute = {
    handler: {
      path: path.join(projectDir, entryPoint),
      name: "handler",
    },
    method: "POST",
    path: "/test",
    prefix: "/api",
  };

  // 4. Run the generator
  return await generateTypes([route]);
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

    const { api } = await runTestAgainstCode(code);
    const result = api["/api/test"]["POST"] as SimpleTypeDefinition;

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

    const { api } = await runTestAgainstCode(code);
    const bodyType = api["/api/test"]["POST"] as SimpleTypeDefinition;

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

    const { api, definitions } = await runTestAgainstCode(code);

    // 1. The Body string should reference the interface name, not the literal
    expect((api["/api/test"]["POST"] as SimpleTypeDefinition).RequestBody).toBe(
      "UserProfile",
    );

    // 2. The definitions array should contain the code for UserProfile
    const defString = definitions.join("\n");
    expect(defString).toContain("export interface UserProfile");
    expect(defString).toContain("username: string;");
    expect(defString).toContain("age?: number;");
  });

  test("Scenario 4: Handles Arrays and Nested Objects", async () => {
    const code = `
      export type Req<P, R, B, Q> = { b: B };

      export const handler = (
        req: Req<{}, {}, { tags: string[]; meta: { created: boolean } }, {}>, 
        res: any
      ) => {};
    `;

    const { api } = await runTestAgainstCode(code);
    const body = (api["/api/test"]["POST"] as SimpleTypeDefinition).RequestBody;

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

    const { api } = await runTestAgainstCode(code);
    const body = (api["/api/test"]["POST"] as SimpleTypeDefinition).RequestBody;

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

    const { api, definitions } = await runProjectTest(files, "controller.ts");

    // 1. Validates that the body type refers to "User" (the name)
    expect((api["/api/test"]["POST"] as SimpleTypeDefinition).RequestBody).toBe(
      "User",
    );

    // 2. Validates that the definition for "User" was found in the other file and extracted
    const allDefs = definitions.join("\n");
    expect(allDefs).toContain("export interface User");
    expect(allDefs).toContain("email: string;");
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

    const { definitions } = await runProjectTest(files, "controller.ts");
    const allDefs = definitions.join("\n");

    console.log({ allDefs });

    // It should define UpdatePayload
    expect(allDefs).toContain("export interface UpdatePayload");

    // AND it should have walked into enums.ts to define Status
    expect(allDefs).toContain('export type Status = "active" | "banned";');
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
    const bodyStr = (api["/api/test"]["POST"] as SimpleTypeDefinition)
      .RequestBody;

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

describe("Adira Library Dependency Resolution", () => {
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
      "src/models/IUser.ts": `
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

      "src/models/Category.ts": `
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

      "src/types.ts": `
        export interface ErrorResponse {
          error: boolean;
          message: string;
        }
      `,

      "src/controller/categories.ts": `
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

    const { api, definitions } = await runProjectTest(
      files,
      "src/controller/categories.ts",
    );

    const defsString = definitions.join("\n");
    console.log({ api, definitions });

    expect(defsString).toContain("export interface ICategory");
    expect(defsString).toContain("name: string;");

    expect(defsString).toContain("export interface ErrorResponse");
    expect(defsString).toContain("message: string;");

    expect(defsString).toContain("export interface IUser");
  });
});
