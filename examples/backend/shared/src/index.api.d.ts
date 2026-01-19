import { CreateCategoryFn, DeleteCategoryFn, GetCategoriesFn, UpdateCategoryFn } from "./controller/categories";
import { CreateOrderFn, DeleteOrderFn, GetOrdersFn, UpdateOrderFn } from "./controller/orders";
import { CreateProductFn, DeleteProductFn, GetProductsFn, UpdateProductFn } from "./controller/products";
import { CreateUserFn, DeleteUserFn, GetUsersFn, UpdateUserFn } from "./controller/users";
import { ErrorResponse } from "./types/index";
import { Backend } from "@n/adira.core.ts";


export type ExampleApiTypes = {
    "/api/users": {
        "GET": {
            RequestParams: any;
            RequestBody: any;
            RequestQuery: Backend.InferHandlerParams<GetUsersFn>;
            ResponseBody: Backend.InferHandlerResponse<GetUsersFn, {}> | ErrorResponse;
        };
        "POST": {
            RequestParams: any;
            RequestBody: any;
            RequestQuery: Backend.InferHandlerParams<CreateUserFn>;
            ResponseBody: Backend.InferHandlerResponse<CreateUserFn, {}> | ErrorResponse;
        };
    };
    "/api/users/:id": {
        "PATCH": {
            RequestParams: {
    id: string;
};
            RequestBody: any;
            RequestQuery: Backend.InferHandlerParams<UpdateUserFn>;
            ResponseBody: Backend.InferHandlerResponse<UpdateUserFn, {}> | ErrorResponse;
        };
        "DELETE": {
            RequestParams: {
    id: string;
};
            RequestBody: any;
            RequestQuery: Backend.InferHandlerParams<DeleteUserFn>;
            ResponseBody: Backend.InferHandlerResponse<DeleteUserFn, {}> | ErrorResponse;
        };
    };
    "/api/categories": {
        "GET": {
            RequestParams: any;
            RequestBody: any;
            RequestQuery: Backend.InferHandlerParams<GetCategoriesFn>;
            ResponseBody: Backend.InferHandlerResponse<GetCategoriesFn, {}> | ErrorResponse;
        };
        "POST": {
            RequestParams: any;
            RequestBody: any;
            RequestQuery: Backend.InferHandlerParams<CreateCategoryFn>;
            ResponseBody: Backend.InferHandlerResponse<CreateCategoryFn, {}> | ErrorResponse;
        };
    };
    "/api/categories/:id": {
        "PATCH": {
            RequestParams: {
    id: string;
};
            RequestBody: any;
            RequestQuery: Backend.InferHandlerParams<UpdateCategoryFn>;
            ResponseBody: Backend.InferHandlerResponse<UpdateCategoryFn, {}> | ErrorResponse;
        };
        "DELETE": {
            RequestParams: {
    id: string;
};
            RequestBody: any;
            RequestQuery: Backend.InferHandlerParams<DeleteCategoryFn>;
            ResponseBody: Backend.InferHandlerResponse<DeleteCategoryFn, {}> | ErrorResponse;
        };
    };
    "/api/products": {
        "GET": {
            RequestParams: any;
            RequestBody: any;
            RequestQuery: Backend.InferHandlerParams<GetProductsFn>;
            ResponseBody: Backend.InferHandlerResponse<GetProductsFn, {}> | ErrorResponse;
        };
        "POST": {
            RequestParams: any;
            RequestBody: any;
            RequestQuery: Backend.InferHandlerParams<CreateProductFn>;
            ResponseBody: Backend.InferHandlerResponse<CreateProductFn, {}> | ErrorResponse;
        };
    };
    "/api/products/:id": {
        "PATCH": {
            RequestParams: {
    id: string;
};
            RequestBody: any;
            RequestQuery: Backend.InferHandlerParams<UpdateProductFn>;
            ResponseBody: Backend.InferHandlerResponse<UpdateProductFn, {}> | ErrorResponse;
        };
        "DELETE": {
            RequestParams: {
    id: string;
};
            RequestBody: any;
            RequestQuery: Backend.InferHandlerParams<DeleteProductFn>;
            ResponseBody: Backend.InferHandlerResponse<DeleteProductFn, {}> | ErrorResponse;
        };
    };
    "/api/orders": {
        "GET": {
            RequestParams: any;
            RequestBody: any;
            RequestQuery: Backend.InferHandlerParams<GetOrdersFn>;
            ResponseBody: Backend.InferHandlerResponse<GetOrdersFn, {}> | ErrorResponse;
        };
        "POST": {
            RequestParams: any;
            RequestBody: any;
            RequestQuery: Backend.InferHandlerParams<CreateOrderFn>;
            ResponseBody: Backend.InferHandlerResponse<CreateOrderFn, {}> | ErrorResponse;
        };
    };
    "/api/orders/:id": {
        "PATCH": {
            RequestParams: {
    id: string;
};
            RequestBody: any;
            RequestQuery: Backend.InferHandlerParams<UpdateOrderFn>;
            ResponseBody: Backend.InferHandlerResponse<UpdateOrderFn, {}> | ErrorResponse;
        };
        "DELETE": {
            RequestParams: {
    id: string;
};
            RequestBody: any;
            RequestQuery: Backend.InferHandlerParams<DeleteOrderFn>;
            ResponseBody: Backend.InferHandlerResponse<DeleteOrderFn, {}> | ErrorResponse;
        };
    };
};