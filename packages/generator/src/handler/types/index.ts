export type METHOD = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * When parsing routers we keep track of "leaf" routes that handle one API endpoint (i.e: We want to know what parameters GET "api/v2/users" needs to execute)
 */
export interface DiscoveredHandler {
  method: METHOD;
  endpoint: string;
  endpointPrefix: string;

  // The `handler` is the actual function used to process a request: router.get("/users", **getUsersHandler**)
  handler: {
    /**
     * The generator uses this as an entry point for traversing the AST and finding type declarations for RequestBody, ResponseBody, RequestParams, RequestPath
     */
    name: string;
    /**
     * The absolute file system path to the TypeScript source file containing the handler.
     *
     * This is passed to `ts.createProgram` to load the file into the compiler context.
     */
    sourcePath: string;
  };

  /**
   * An optional global prefix for the route (e.g., "/api/v1").
   * If present, this is prepended to `path` to ensure the generated SDK
   * uses the full, correct URL.
   */
  prefix?: string;
}

/**
 * This will be used for coupling variables to the file they are imported in:
 * For example if we do: `import { getUsersHandler } from '@controllers/users'` inside `src/routers/users.ts`
 * We will get:
 * ```
 * {
 *    getUsersHandler: {
 *      file: "src/routers/users.ts"
 *      isDefault: false
 *    }
 * }
 * ```
 */
export interface ImportInfo {
  file: string; // Absolute path to the module
  isDefault: boolean;
}
