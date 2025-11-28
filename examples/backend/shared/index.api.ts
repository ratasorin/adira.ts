// --------------------------------------------------------------------------
// This file is auto-generated. Do not edit directly.
// --------------------------------------------------------------------------

// --- Inlined Backend Types ---
export type ObjectIdLike = string;

export type GetUsersFn = unknown;

export type InferHandlerParams<Handler> = unknown;

export type InferHandlerResponse<Handler, HandlerExtraWorkReturn> = unknown;

export interface ErrorResponse {
  message: string;
  error: unknown;
}

export type CreateUserFn = unknown;

export type UpdateUserFn = unknown;

export type DeleteUserFn = unknown;

export type GetCategoriesFn = ExecuteGET<ICategory>;

export interface ICategory {
  _id: string;
  name: string;
  description: string;
  slug: string;
  parentCategory: string & RefTo<ICategory>;
  createdBy: string & RefTo<IUser>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export type RefTo<T> = {

};

export interface IUser {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
  deletedAt?: string;
  orders?: unknown[];
}

export type ExecuteGET<T, PSchema = PopulateSchema<unknown>> = unknown & {

};

export type PopulateSchema<Schema> = ApplyReplacements<unknown>;

export type ApplyReplacements<Schema = {

}, Depth extends number = "10"> = unknown;

export type CreateCategoryFn = ExecutePOST<ICategory>;

export type ExecutePOST<T, PSchema = PopulateSchema<unknown>> = unknown & {

};

export type UpdateCategoryFn = ExecutePATCH<ICategory>;

export type ExecutePATCH<T, PSchema = PopulateSchema<unknown>> = unknown & {

};

export type DeleteCategoryFn = ExecuteDELETE<ICategory>;

export type ExecuteDELETE<T, PSchema = PopulateSchema<unknown>> = unknown & {

};

export type GetProductsFn = unknown;

export type CreateProductFn = unknown;

export type UpdateProductFn = unknown;

export type DeleteProductFn = unknown;

export type GetOrdersFn = unknown;

export type CreateOrderFn = unknown;

export type UpdateOrderFn = unknown;

export type DeleteOrderFn = unknown;

export type ApiTypes = {
  "/api/users": {
    "GET": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<GetUsersFn, {

}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<GetUsersFn>;
    };
    "POST": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<CreateUserFn, {

}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<CreateUserFn>;
    };
  };

  "/api/users/:id": {
    "PATCH": {
      RequestParams?: {
  id: string;
};
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<UpdateUserFn, {

}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<UpdateUserFn>;
    };
    "DELETE": {
      RequestParams?: {
  id: string;
};
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<DeleteUserFn, {

}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<DeleteUserFn>;
    };
  };

  "/api/categories": {
    "GET": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<GetCategoriesFn, {

}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<GetCategoriesFn>;
    };
    "POST": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<CreateCategoryFn, {

}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<CreateCategoryFn>;
    };
  };

  "/api/categories/:id": {
    "PATCH": {
      RequestParams?: {
  id: string;
};
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<UpdateCategoryFn, {

}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<UpdateCategoryFn>;
    };
    "DELETE": {
      RequestParams?: {
  id: string;
};
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<DeleteCategoryFn, {

}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<DeleteCategoryFn>;
    };
  };

  "/api/products": {
    "GET": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<GetProductsFn, {

}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<GetProductsFn>;
    };
    "POST": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<CreateProductFn, {

}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<CreateProductFn>;
    };
  };

  "/api/products/:id": {
    "PATCH": {
      RequestParams?: {
  id: string;
};
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<UpdateProductFn, {

}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<UpdateProductFn>;
    };
    "DELETE": {
      RequestParams?: {
  id: string;
};
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<DeleteProductFn, {

}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<DeleteProductFn>;
    };
  };

  "/api/orders": {
    "GET": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<GetOrdersFn, {

}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<GetOrdersFn>;
    };
    "POST": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<CreateOrderFn, {

}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<CreateOrderFn>;
    };
  };

  "/api/orders/:id": {
    "PATCH": {
      RequestParams?: {
  id: string;
};
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<UpdateOrderFn, {

}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<UpdateOrderFn>;
    };
    "DELETE": {
      RequestParams?: {
  id: string;
};
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<DeleteOrderFn, {

}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<DeleteOrderFn>;
    };
  };
};
