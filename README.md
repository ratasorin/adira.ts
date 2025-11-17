# @n/adira.ts

A powerful TypeScript-based tool for generating API definitions from Express.js REST endpoints with MongoDB schemas. This tool automatically analyzes your Express.js codebase to extract API route information and generate corresponding TypeScript type definitions, enabling seamless, strongly-typed backend integrations. Includes advanced utilities for generating MongoDB aggregation functions for rapid backend development.

## Overview

Adira.ts is designed to bridge the gap between your Express.js API implementation and frontend consumption by automatically generating TypeScript type definitions based on your actual API routes and handler function signatures. The tool parses your Express.js routers and route handlers to extract:

- HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Route paths with prefixes
- Request/Response type information from handler function signatures
- Import dependencies for proper type resolution
- MongoDB ObjectId handling with specific type replacements

Additionally, the tool provides a `generateHandler` utility that enables rapid backend development by generating MongoDB aggregation functions for common operations like select, include, filter, groupBy, and partition.

## Features

- **Automatic route detection**: Discovers Express.js routes by parsing router definitions and `.use()` calls
- **Type extraction**: Extracts request/response types directly from handler function signatures
- **Import management**: Automatically analyzes and includes necessary imports for generated types
- **MongoDB support**: Handles Mongoose ObjectId types with special replacement logic
- **Handler generation**: Provides utilities for generating MongoDB aggregation functions for common operations (select, include, filter, groupBy, partition)
- **Watch mode**: Monitors source files for changes and regenerates types automatically
- **Package publishing**: Integrates with Verdaccio for local package registry publishing

## Prerequisites

- Node.js 16+
- TypeScript
- Express.js routes with typed handler functions

## Installation

```bash
npm install @n/adira.ts
```

## Getting Started

### Basic Usage

1. Ensure your Express.js routes use typed handler functions:

```typescript
// Example route handler with type annotations
export const getInvoices = (req: Request<{ id: string }, any, any>, res: Response<Invoice[]>) => {
  // Handler implementation
};
```

2. Run the type generation:

```bash
npm run types:generate
```

### Development Workflow

The tool can run in watch mode to automatically regenerate types when source files change:

```bash
# This will start the tool in watch mode with automatic publishing
npx ts-node ./index.ts
```

This will:
1. Parse all routes in `src/**/*.ts` files
2. Extract type information from handler functions
3. Generate type definitions in `src/generated/index.api.ts`
4. Start a local Verdaccio registry
5. Publish the generated types as a package
6. Watch for file changes and repeat the process

## Examples

See the `/examples/backend` directory for a demo with Mongoose User model and typed routes showcasing schema integration. Also check `/examples/demo-backend` for a basic setup.

## Project Structure

```
adiraTS/
├── index.ts            # Main entry point with watch/publish logic
├── src/
│   ├── parser.ts       # Route parsing logic
│   ├── typegen.ts      # Type extraction and generation
│   ├── writer.ts       # Generated file writing logic
│   ├── generate-handler.ts # MongoDB aggregation utilities for rapid development
│   ├── helper/         # Utility functions
│   └── __tests__/      # Test files
├── package.json        # Project configuration
├── tsconfig.json       # TypeScript configuration
└── jest.config.js      # Testing configuration
```

## Configuration

The tool respects your project's `tsconfig.json` for path resolution and type checking. Ensure your TypeScript configuration is properly set up with appropriate paths and module resolution settings.

## Scripts

- `npm run test`: Run Jest tests
- `npm run types:generate`: Generate API type definitions
- `npm run types:publish`: Publish generated types to local registry
- `npm run types:build`: Build the type package
- `npm run types:remove`: Remove published package
- `npm run types:serve`: Start Verdaccio local registry

## Using Generate Handler for Rapid Development

The `generate-handler.ts` utility provides powerful types and functions for rapid backend development with MongoDB aggregations:

### Basic Usage

```typescript
import { generateRouteHandler, GetInclude, GetSelect, GetAggregation, GetResponseBody } from "@n/adira.ts";

// Generate handlers for your models
export const getInvoices = generateRouteHandler<"GET", IInvoice, InvoiceReplacements>("GET", Invoice);
export const postInvoice = generateRouteHandler<"POST", IInvoice, InvoiceReplacements>("POST", Invoice);
export const patchInvoice = generateRouteHandler<"PATCH", IInvoice, InvoiceReplacements>("PATCH", Invoice);

// Create typed handler functions
export type GetInvoicesFn = typeof getInvoices;

export const getInvoicesHandler = async <
  Include extends GetInclude<GetInvoicesFn>,
  Select extends GetSelect<GetInvoicesFn, Include>,
  Aggregations extends GetAggregation<GetInvoicesFn>,
  ObjectAfterJoin extends GetObjectAfterJoin<GetInvoicesFn, Include>
>(
  req: Request<any, any, any, GetParams<Include, Select, Aggregations, ObjectAfterJoin>>,
  res: Response<
    | ErrorResponse
    | GetResponseBody<GetInvoicesFn, Include, Select, Aggregations, {}>
  >
) => {
  try {
    const invoices = await getInvoices(req.query);
    res.status(200).send({ base: invoices });
  } catch (error) {
    res.status(500).json({ message: String(error), error: true });
  }
};
```

### Frontend Usage with Generated Types

The generated types allow for type-safe API calls like:

```typescript
apiCall("/invoice/", "GET", {
  query: {
    include: ["issuer_company", "modifiers.modifier", "reporter"] as const,
    select: [
      "modifiers.modifier.value",
      "receiving_customer",
      "issuer_company.details",
      "reporter.created_by",
    ] as const,
    groupBy: {
      fields: ["version"],
      aggregations: [
        {
          alias: "sumOfNumbers",
          applyOnField: "number",
          op: "$sum",
        },
        {
          alias: "countOfNumbers",
          applyOnField: "number",
          op: "$count",
        },
      ],
    } as const,
  },
}).then((res) => {
  if (isError(res)) {
    return;
  }

  const issuerCompanyDetails = res.base?.documents;
});
```

This enables strongly-typed API interactions without writing extra boilerplate code.

## Type Generation Process

1. **Parsing**: The tool scans `src/**/*.ts` files to identify Express.js routes and their handlers
2. **Type Extraction**: TypeScript AST is used to extract type information from handler function parameters
3. **Import Resolution**: Dependencies are analyzed to ensure proper imports in generated types
4. **File Generation**: TypeScript definition file is written to `src/generated/index.api.ts`
5. **Post-processing**: Mongoose ObjectId types are replaced with `ObjectIdLike` type
6. **Publishing**: Generated types are published to the local package registry

## Generated Output

The tool generates a comprehensive API type map that looks like:

```typescript
export type InvoicifyAPI = {
  "/api/invoices": {
    "GET": {
      RequestQuery?: InvoiceQuery;
      ResponseBody?: Invoice[];
    };
    "POST": {
      RequestBody?: CreateInvoiceRequest;
      ResponseBody?: Invoice;
    };
  };
};
```

## Troubleshooting

- If types are not generated properly, ensure your handler functions have proper TypeScript type annotations
- If import resolution fails, check your `tsconfig.json` path aliases and module resolution settings
- For Verdaccio issues, ensure port 8888 is available or Verdaccio is properly configured

## Contributing

Contributions are welcome! Please submit issues for bugs or feature requests, and pull requests for code improvements.

## License

MIT