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

  // "/api/products": {
  //   GET: {
  //     RequestParams?: any;
  //     RequestBody?: any;
  //     ResponseBody?:
  //       | Backend.InferHandlerResponse<GetProductsFn, {}>
  //       | ErrorResponse;
  //     RequestQuery?: Backend.InferHandlerParams<GetProductsFn>;
  //   };
  //   POST: {
  //     RequestParams?: any;
  //     RequestBody?: Backend.InferHandlerParams<CreateProductFn>;
  //     ResponseBody?:
  //       | Backend.InferHandlerResponse<CreateProductFn, {}>
  //       | ErrorResponse;
  //   };
  // };

  // "/api/products/:id": {
  //   PUT: {
  //     RequestParams?: any;
  //     RequestBody?: Backend.InferHandlerParams<UpdateProductFn>;
  //     ResponseBody?:
  //       | Backend.InferHandlerResponse<UpdateProductFn, {}>
  //       | ErrorResponse;
  //   };
  //   DELETE: {
  //     RequestParams?: any;
  //     RequestBody?: Backend.InferHandlerParams<DeleteProductFn>;
  //     ResponseBody?:
  //       | Backend.InferHandlerResponse<DeleteProductFn, {}>
  //       | ErrorResponse;
  //   };
  // };

  // "/api/orders": {
  //   GET: {
  //     RequestParams?: any;
  //     RequestBody?: any;
  //     ResponseBody?:
  //       | Backend.InferHandlerResponse<GetOrdersFn, {}>
  //       | ErrorResponse;
  //     RequestQuery?: Backend.InferHandlerParams<GetOrdersFn>;
  //   };
  //   POST: {
  //     RequestParams?: any;
  //     RequestBody?: Backend.InferHandlerParams<CreateOrderFn>;
  //     ResponseBody?:
  //       | Backend.InferHandlerResponse<CreateOrderFn, {}>
  //       | ErrorResponse;
  //   };
  // };

  // "/api/orders/:id": {
  //   PUT: {
  //     RequestParams?: any;
  //     RequestBody?: Backend.InferHandlerParams<UpdateOrderFn>;
  //     ResponseBody?:
  //       | Backend.InferHandlerResponse<UpdateOrderFn, {}>
  //       | ErrorResponse;
  //   };
  //   DELETE: {
  //     RequestParams?: any;
  //     RequestBody?: Backend.InferHandlerParams<DeleteOrderFn>;
  //     ResponseBody?:
  //       | Backend.InferHandlerResponse<DeleteOrderFn, {}>
  //       | ErrorResponse;
  //   };
  // };
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

const apiClient = createApiClient<DemoAppAPI>("http://localhost:3000");
const queryCategories = apiClient("/categories", "GET");

queryCategories({
  include: ["createdBy"] as const,
  select: ["name", "createdBy"] as const,
  groupBy: ["createdBy.email"] as const,
  aggregates: [
    {
      as: "distinctCreators",
      fn: "$count",
      on: "createdBy._id",
    },
    {
      as: "oldestCreator",
      fn: "$min",
      on: "createdBy.createdAt",
    },
  ] as const,
  where: {
    "createdBy.email": {
      $regex: /@example\.com$/,
    },
  },
}).then((response) => {
  if (isError(response)) {
    console.error("API Error:", response.message);
  } else {
    const r = response.executor?.items;
  }
});
