import { Backend } from "..";
import { ExecuteGET, ExecutePATCH, ExecutePOST } from "../helpers/backend";
import { CreateAxiosApiClient } from "../helpers/frontend";
import { ICategory } from "./models/Category";
import { IUser } from "./models/Users";

export interface ErrorResponse {
  error: true;
  message: string;
}

type GetUsersFn = ExecuteGET<IUser, {}>;
type GetCategoriesFn = ExecuteGET<ICategory>;
type CreateCategoryFn = ExecutePOST<ICategory>;
type UpdateCategoryFn = ExecutePATCH<ICategory>;

export type DemoAppAPI = {
  "/api/users": {
    GET: {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?:
        | Backend.InferHandlerResponse<GetUsersFn, {}>
        | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<GetUsersFn>;
    };
  };

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

queryCategories({
  include: ["createdBy"] as const,
  rows: {
    select: ["name", "createdBy"],
    pickDistinct: { by: "_id", keep: "first", sortBy: "isActive" },
    sortBy: {},
  } as const,
  groups: {
    byCategory: {
      by: ["parentCategory"],
      aggregates: [
        { on: "updatedAt", fn: "$sum", as: "total" },
        { on: "createdAt", fn: "$sum", as: "totalCreated" },
      ] as const,
      sortBy: {
        total: -1,
      },
    },
  },
  where: {
    "createdBy.email": {
      $regex: /@example\.com$/,
    },
  },
});
