import ts from "typescript";
import { gatherImports, ImportMap } from "../../../src/typegen";

describe("gatherImports Integration Test", () => {
  const FILENAME = "/app/src/api-types.ts";
  const API_SOURCE_CODE = `
    import { ErrorResponse, IInvoiceChangeLog, ObjectIdLike, AvailableKeys, Schema } from '@types/index';
    import { LoginResponseBody } from '@controller/auth/login';
    import { IInvoice } from '@models/invoice/Invoice';
    import { PatchResponseBody, InferParams, InferInclude, InferSelect } from '@utils/api/generate-handler';

    // Mock functions/types used in the generic
    type PatchInvoiceFn = any;

    export type _api_invoice_patch<Include extends InferInclude<PatchInvoiceFn>, Select extends InferSelect<PatchInvoiceFn, Include>> = {
      RequestParams?: { id?: ObjectIdLike, key: AvailableKeys<Schema> } & InferParams<Include, Select>;
      RequestBody?: Omit<Partial<IInvoice>, "_id">;
      ResponseBody?: PatchResponseBody<PatchInvoiceFn, Include, Select, IInvoiceChangeLog | null> | ErrorResponse;
      RequestQuery?: unknown;
      RequestForm?: unknown;
    };
    
    export type _api_auth_login = {
        RequestBody?: { email: string };
        ResponseBody?: ErrorResponse | LoginResponseBody;
    }
  `;

  // Create Source File and program environment
  const sourceFile = ts.createSourceFile(
    FILENAME,
    API_SOURCE_CODE,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.TS,
  );

  /**
   * Helper to find a TypeNode for a specific type alias field.
   */
  function findTypeNode(
    aliasName: string,
    fieldName: string,
  ): ts.TypeNode | undefined {
    let targetNode: ts.TypeNode | undefined;

    ts.forEachChild(sourceFile, (node) => {
      if (
        ts.isTypeAliasDeclaration(node) &&
        node.name.getText() === aliasName
      ) {
        if (ts.isTypeLiteralNode(node.type)) {
          for (const member of node.type.members) {
            if (
              ts.isPropertySignature(member) &&
              member.name.getText() === fieldName
            ) {
              targetNode = member.type;
            }
          }
        }
      }
    });

    if (!targetNode) {
      throw new Error(
        `Could not find type node for \${aliasName}.\${fieldName}`,
      );
    }

    return targetNode;
  }

  test("Case 1: Should correctly gather imports from a simple Union Type", () => {
    const importMap: ImportMap = {};
    const node = findTypeNode("_api_auth_login", "ResponseBody");

    gatherImports(node, importMap, sourceFile);

    expect(importMap).toEqual({
      "@types/index": ["ErrorResponse"],
      "@controller/auth/login": ["LoginResponseBody"],
    });
  });

  test("Case 2: Should gather imports from a TypeOperator (Omit) and its operand", () => {
    const importMap: ImportMap = {};
    const node = findTypeNode("_api_invoice_patch", "RequestBody");

    gatherImports(node, importMap, sourceFile);

    expect(importMap).toEqual({
      "@models/invoice/Invoice": ["IInvoice"],
    });
  });

  test("Case 3: Should find and gather the deeply nested IInvoiceChangeLog import", () => {
    const importMap: ImportMap = {};
    const node = findTypeNode("_api_invoice_patch", "ResponseBody");

    gatherImports(node, importMap, sourceFile);

    expect(importMap).toEqual({
      "@types/index": ["IInvoiceChangeLog", "ErrorResponse"],
      "@utils/api/generate-handler": ["PatchResponseBody"],
    });
  });

  test("Case 4: Should find and gather the deeply nested IInvoiceChangeLog, ObjectIdLike, AvailableKeys, Schema", () => {
    const importMap: ImportMap = {};
    const node = findTypeNode("_api_invoice_patch", "RequestParams");

    gatherImports(node, importMap, sourceFile);

    expect(importMap).toEqual({
      "@utils/api/generate-handler": ["InferParams"],
      "@types/index": ["ObjectIdLike", "Schema", "AvailableKeys"],
    });
  });
});
