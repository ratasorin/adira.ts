import { runImportsTest } from "../tests";

describe("Import Generator", () => {
  test("Should preserve 'import { Backend }' when Backend is a module namespace", () => {
    const files = {
      // --- 1. MOCK EXTERNAL LIBRARY (node_modules) ---
      "/node_modules/@n/adira.core/package.json": `{"name": "@n/adira.core", "main": "index.d.ts"}`,
      "/node_modules/@n/adira.core/index.d.ts": `
        export * as Backend from './backend'; 
      `,
      "/node_modules/@n/adira.core/backend.d.ts": `
        export type InferHandlerParams<T> = { data: T };
        export type InferHandlerResponse<T, K> = { response: T };
      `,

      // --- 2. LOCAL CODE (src) ---
      "/src/controller/users.ts": `
        export const GetUsersFn = () => {};
      `,

      // --- 3. THE ENTRY FILE (WhereDefinition we write our types) ---
      // note: We use { Backend } (Named Import) even though it's a Namespace in the lib
      "/src/index.ts": `
        import { Backend } from '@n/adira.core'; 
        import { GetUsersFn } from './controller/users';

        // We want to generate imports for THIS type node:
        type Target = Backend.InferHandlerParams<typeof GetUsersFn>;
      `,
    };

    const { output } = runImportsTest(files, "Target", "/src/generated/api.ts");

    expect(output).toContain(`import { Backend } from "@n/adira.core";`);
    expect(output).toContain(
      `import { GetUsersFn } from "../controller/users";`,
    );
    expect(output).not.toMatch(/import.*node_modules/);
  });

  test("Should handle local Renames", () => {
    const files = {
      "/src/types.ts": "export interface User { id: number; }",
      "/src/index.ts": `
            import { User as MyUser } from './types';
            type Target = MyUser;
        `,
    };

    const { output } = runImportsTest(files, "Target", "/src/generated.ts");
    expect(output).toContain(`import { User as MyUser } from "./types";`);
  });

  test("Should handle deeply nested generics and array syntax", () => {
    const files = {
      "/src/models.ts": "export class User { id: number; }",
      "/src/responses.ts": "export class Paginated<T> { items: T[]; }",
      "/src/index.ts": `
        import { User } from './models';
        import { Paginated } from './responses';

        // Target: Promise<Paginated<User[]>>
        // Should collect: Promise (global, ignore), Paginated, User
        type Target = Promise<Paginated<User[]>>;
      `,
    };

    const { output } = runImportsTest(files, "Target");

    // "Promise" is global, so it should NOT be imported
    expect(output).not.toContain("Promise");
    expect(output).toContain(`import { User } from "./models";`);
    expect(output).toContain(`import { Paginated } from "./responses";`);
  });

  // --- 2. QUALIFIED NAMES (The logic you just cleaned up) ---
  test("Should only import the ROOT of a Qualified Name", () => {
    const files = {
      // Mocking a library that exports a Namespace-like object
      "/node_modules/@lib/core/index.d.ts": `
        export namespace Backend {
            export type Request = { body: string };
            export type Response = { code: number };
        }
      `,
      "node_modules/@lib/core/package.json": `{ "name": "@lib/core" }`,
      "/src/index.ts": `
        import { Backend } from '@lib/core';

        // Target: Backend.Request | Backend.Response
        // The collector should see "Backend.Request", visit "Backend", keep "Backend".
        // It should see "Request" (right side) and IGNORE it.
        type Target = Backend.Request | Backend.Response;
      `,
    };

    const { output } = runImportsTest(files, "Target");

    // Should import Backend
    expect(output).toContain(`import { Backend } from "@lib/core";`);

    // Should NOT try to import Request or Response directly
    expect(output).not.toContain("Request");
    expect(output).not.toContain("Response");
  });

  // --- 3. RENAMED IMPORTS (Named) ---
  test("Should respect 'import { Real as Alias }'", () => {
    const files = {
      "/src/services.ts": "export class Service { call() {} }",
      "/src/index.ts": `
        import { Service as MyService } from './services';

        type Target = MyService; 
      `,
    };

    const { output } = runImportsTest(files, "Target");

    // Must generate the alias syntax exactly
    expect(output).toContain(
      `import { Service as MyService } from "./services";`,
    );
  });

  // --- 4. DEFAULT IMPORTS ---
  test("Should respect default imports", () => {
    const files = {
      "/src/logger.ts": "export default class Logger {}",
      "/src/index.ts": `
        import Log from './logger';
        type Target = Log;
      `,
    };

    const { output } = runImportsTest(files, "Target");

    expect(output).toContain(`import Log from "./logger";`);
  });

  // --- 5. MIXED IMPORTS (Same Module, Different Styles) ---
  // This verifies that your generator splits them into valid lines
  test("Should handle Default + Named + Namespace from the same module", () => {
    const files = {
      "/node_modules/react/index.d.ts": `
        export default class React {}
        export const useState: any;
        export const useEffect: any;
      `,
      "/node_modules/react/package.json": ` { "name": "react" } `,
      "/src/index.ts": `
        import React, { useState } from 'react';
        import * as ReactNamespace from 'react';

        // We use all of them in the type
        type Target = [React, typeof useState, typeof ReactNamespace];
      `,
    };

    const { output } = runImportsTest(files, "Target");

    // Since your generator logic splits them (which is safe), we expect separate lines:
    // 1. Default
    expect(output).toContain(`import React from "react";`);
    // 2. Named
    expect(output).toContain(`import { useState } from "react";`);
    // 3. Namespace
    expect(output).toContain(`import * as ReactNamespace from "react";`);
  });

  // --- 6. INLINE IMPORT TYPES ---
  // The crawler traverses `import('./foo').Bar`.
  // Ideally, the generator should "normalize" this to a top-level import.
  test("Should normalize inline import types to top-level imports", () => {
    const files = {
      "/src/config.ts": "export type Config = { debug: boolean; };",
      "/src/index.ts": `
        // No top-level import here!
        type Target = import('./config').Config;
      `,
    };

    const { output } = runImportsTest(files, "Target");

    // It should hoist it to a top-level import
    expect(output).toContain(`import { Config } from "./config";`);
  });

  // --- 7. LOCAL VARIABLES EXPORTED ---
  // Sometimes we define a class locally, export it, and use it in a type.
  // The generator needs to realize it's coming from a relative file, not "current file"
  // Note: runImportsTest runs generator relative to /src/generated.ts, so /src/index.ts IS external.
  test("Should generate imports for locally defined exports", () => {
    const files = {
      "/src/index.ts": `
        export class LocalClass { id: string; }
        
        type Target = LocalClass;
      `,
    };

    const { output } = runImportsTest(files, "Target");

    // Since we are generating into /src/generated.ts, we need to import LocalClass from ../index
    expect(output).toContain(`import { LocalClass } from "./index";`);
  });

  // --- 8. RENAMED NAMESPACE IMPORT ---
  // Edge Case: import * as L from '...'; type T = L.Something;
  test("Should handle Namespace Import usages", () => {
    const files = {
      "/src/utils.ts": "export const add = (a: number) => a;",
      "/src/index.ts": `
        import * as Utils from './utils';
        type Target = typeof Utils.add;
      `,
    };

    const { output } = runImportsTest(files, "Target");

    // Should detect the NamespaceImport syntax in the source AST
    expect(output).toContain(`import * as Utils from "./utils";`);
  });
});
