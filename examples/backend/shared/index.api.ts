import { GetUsersFn, CreateUserFn, UpdateUserFn, DeleteUserFn } from '../src/controller/users';
import { Backend } from '@n/adira.core.ts';
import { ErrorResponse } from '../src/types/index';
import { GetCategoriesFn, CreateCategoryFn, UpdateCategoryFn, DeleteCategoryFn } from '../src/controller/categories';
import { GetProductsFn, CreateProductFn, UpdateProductFn, DeleteProductFn } from '../src/controller/products';
import { GetOrdersFn, CreateOrderFn, UpdateOrderFn, DeleteOrderFn } from '../src/controller/orders';

export type AdiraTypes = {
  "/api/users": {
    "GET": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<GetUsersFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<GetUsersFn>;
    };
    "POST": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<CreateUserFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<CreateUserFn>;
    };
  };

  "/api/users/:id": {
    "PATCH": {
      RequestParams?: { id: string };
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<UpdateUserFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<UpdateUserFn>;
    };
    "DELETE": {
      RequestParams?: { id: string };
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<DeleteUserFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<DeleteUserFn>;
    };
  };

  "/api/categories": {
    "GET": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<GetCategoriesFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<GetCategoriesFn>;
    };
    "POST": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<CreateCategoryFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<CreateCategoryFn>;
    };
  };

  "/api/categories/:id": {
    "PUT": {
      RequestParams?: { id: string };
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<UpdateCategoryFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<UpdateCategoryFn>;
    };
    "DELETE": {
      RequestParams?: { id: string };
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<DeleteCategoryFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<DeleteCategoryFn>;
    };
  };

  "/api/products": {
    "GET": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<GetProductsFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<GetProductsFn>;
    };
    "POST": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<CreateProductFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<CreateProductFn>;
    };
  };

  "/api/products/:id": {
    "PUT": {
      RequestParams?: { id: string };
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<UpdateProductFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<UpdateProductFn>;
    };
    "DELETE": {
      RequestParams?: { id: string };
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<DeleteProductFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<DeleteProductFn>;
    };
  };

  "/api/orders": {
    "GET": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<GetOrdersFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<GetOrdersFn>;
    };
    "POST": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<CreateOrderFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<CreateOrderFn>;
    };
  };

  "/api/orders/:id": {
    "PUT": {
      RequestParams?: { id: string };
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<UpdateOrderFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<UpdateOrderFn>;
    };
    "DELETE": {
      RequestParams?: { id: string };
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<DeleteOrderFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<DeleteOrderFn>;
    };
  };
};
