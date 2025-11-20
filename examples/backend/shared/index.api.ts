import { GetUsersFn } from '../src/controller/users';
import { InferHandlerParams, InferHandlerResponse } from '@n/adira.backend.ts';
import { ErrorResponse } from '../src/types/index';

export type InvoicifyAPI = {
  "/api/users": {
    "GET": {
      RequestParams?: any;
      RequestBody?: any;
      ResponseBody?: InferHandlerResponse<GetUsersFn, {}> | ErrorResponse;
      RequestQuery?: InferHandlerParams<GetUsersFn>;
    };
  };
};
