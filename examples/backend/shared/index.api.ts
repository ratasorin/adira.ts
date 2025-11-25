import { GetUsersFn } from '../src/controller/users';
import { Backend } from '@n/adira.backend.ts';
import { ErrorResponse } from '../src/types/index';
import { GetCategoriesFn, CreateCategoryFn, UpdateCategoryFn } from '../src/controller/categories';
import { Backend } from '@n/adira.core.ts';
import { GetProductsFn, CreateProductFn, UpdateProductFn, DeleteProductFn } from '../src/controller/products';
import { GetOrdersFn, CreateOrderFn, UpdateOrderFn, DeleteOrderFn } from '../src/controller/orders';

export type InvoicifyAPI = {
  "/api/users": {
    "GET": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: Backend.InferHandlerResponse<GetUsersFn, {}> | ErrorResponse;
      RequestQuery?: Backend.InferHandlerParams<GetUsersFn>;
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
      RequestBody?: Backend.InferHandlerParams<CreateProductFn>;
      ResponseBody?: Backend.InferHandlerResponse<CreateProductFn, {}> | ErrorResponse;
    };
  };

  "/api/products/:id": {
    "PUT": {
      RequestParams?: any;
      RequestBody?: Backend.InferHandlerParams<UpdateProductFn>;
      ResponseBody?: Backend.InferHandlerResponse<UpdateProductFn, {}> | ErrorResponse;
    };
    "DELETE": {
      RequestParams?: any;
      RequestBody?: Backend.InferHandlerParams<DeleteProductFn>;
      ResponseBody?: Backend.InferHandlerResponse<DeleteProductFn, {}> | ErrorResponse;
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
      RequestBody?: Backend.InferHandlerParams<CreateOrderFn>;
      ResponseBody?: Backend.InferHandlerResponse<CreateOrderFn, {}> | ErrorResponse;
    };
  };

  "/api/orders/:id": {
    "PUT": {
      RequestParams?: any;
      RequestBody?: Backend.InferHandlerParams<UpdateOrderFn>;
      ResponseBody?: Backend.InferHandlerResponse<UpdateOrderFn, {}> | ErrorResponse;
    };
    "DELETE": {
      RequestParams?: any;
      RequestBody?: Backend.InferHandlerParams<DeleteOrderFn>;
      ResponseBody?: Backend.InferHandlerResponse<DeleteOrderFn, {}> | ErrorResponse;
    };
  };
};
