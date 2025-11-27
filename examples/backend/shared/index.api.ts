// --------------------------------------------------------------------------
// This file is auto-generated. Do not edit directly.
// --------------------------------------------------------------------------

// --- Whitelisted Dependencies ---
import { Backend } from "@n/adira.core.ts";

export type GetCategoriesFn = Backend.ExecuteGET<ICategory>;
export type CreateCategoryFn = Backend.ExecutePOST<ICategory>;
export type UpdateCategoryFn = Backend.ExecutePATCH<ICategory>;
export type DeleteCategoryFn = Backend.ExecuteDELETE<ICategory>;

export type ApiTypes = {
  "/api/categories": {
    GET: {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?:
        | Backend.InferHandlerResponse<GetCategoriesFn, {}>
        | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<GetCategoriesFn>;
    };
    POST: {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?:
        | Backend.InferHandlerResponse<CreateCategoryFn, {}>
        | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<CreateCategoryFn>;
    };
  };

  "/api/categories/:id": {
    PATCH: {
      RequestParams?: { id: string };
      RequestBody?: any;
      ResponseBody?:
        | Backend.InferHandlerResponse<UpdateCategoryFn, {}>
        | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<UpdateCategoryFn>;
    };
    DELETE: {
      RequestParams?: { id: string };
      RequestBody?: any;
      ResponseBody?:
        | Backend.InferHandlerResponse<DeleteCategoryFn, {}>
        | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<DeleteCategoryFn>;
    };
  };
};
