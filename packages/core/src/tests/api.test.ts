import {
  AggregateOperation,
  Backend,
  GroupIntent,
  Leafs,
  RELATED_KEY,
  SortByDefinition,
} from "..";
import { ExecuteGET, ExecutePATCH, ExecutePOST } from "../helpers/backend";
import { CreateAxiosApiClient } from "../helpers/frontend";
import { ICategory } from "./models/Category";
import { IUser } from "./models/Users";

export interface ErrorResponse {
  error: true;
  message: string;
}

type GetUsersFn = ExecuteGET<IUser>;
type GetCategoriesFn = ExecuteGET<ICategory>;
type CreateCategoryFn = ExecutePOST<ICategory>;
type UpdateCategoryFn = ExecutePATCH<ICategory>;

export type DemoAppAPI = {
  "/api/users": {
    GET: {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<GetUsersFn> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<GetUsersFn>;
    };
  };

  "/api/generate/:id": {
    GET: {
      RequestParams: { id: string };
      RequestBody: any;
      ResponseBody: ArrayBuffer;
      RequestQuery: {
        asyncGenToken: string;
      };
    };
  };

  "/api/categories": {
    GET: {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?:
        | Backend.InferHandlerResponse<GetCategoriesFn>
        | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<GetCategoriesFn>;
    };
    POST: {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?:
        | Backend.InferHandlerResponse<CreateCategoryFn>
        | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<CreateCategoryFn>;
    };
  };

  "/api/categories/:id": {
    PATCH: {
      RequestParams?: { id: string };
      RequestBody?: any;
      ResponseBody?:
        | Backend.InferHandlerResponse<UpdateCategoryFn>
        | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<UpdateCategoryFn>;
    };
  };
};

const isError = (response: any): response is ErrorResponse => {
  return (
    response && response.error === true && typeof response.message === "string"
  );
};

export const createApiClient: CreateAxiosApiClient = (baseUrl) => {
  const m: any = async (url, method) => {
    return {};
  };

  return m;
};

export const apiClient = createApiClient<DemoAppAPI>("http://localhost:3000");
export const queryCategories = apiClient("/categories", "GET");

const { run: runQueryCategories } = queryCategories({
  query: {
    include: ["createdBy", "parentCategory"],
    rows: (r) =>
      r({
        select: ["createdBy.email", "createdBy.createdAt"],
      }),
    groups: (g) => ({
      A: g({
        by: ["createdBy.name"],
        aggregates: [{ as: "distinctNames", fn: "$count", on: "_id" }],
        limit: 10,
        sortBy: {
          distinctNames: -1,
        },
      }),
    }),
  },
});
runQueryCategories().then((r) => {
  if (isError(r)) return;
  r.executor?.rows[0].createdBy;
});

export const generatePdf = apiClient("/generate/:id", "GET");

const { run: runGeneratePdf } = generatePdf({ query: { asyncGenToken: "" } });
