import { GetUsersFn } from "../src/controller/users";
import {
  InferInclude,
  InferSelect,
  GetAggregation,
  GetObjectAfterJoin,
  InferParams,
  GetResponseBody,
} from "@n/adira.backend.ts";
import { ErrorResponse } from "../src/types/index";

export type _api_usersget<
  Include extends InferInclude<GetUsersFn>,
  Select extends InferSelect<GetUsersFn, Include>,
  Aggregations extends GetAggregation<GetUsersFn>,
  ObjectAfterJoin extends GetObjectAfterJoin<GetUsersFn, Include>,
> = {
  RequestParams?: any;
  RequestBody?: any;
  ResponseBody?:
    | ErrorResponse
    | GetResponseBody<GetUsersFn, Include, Select, Aggregations, {}>;
  RequestQuery?: InferParams<Include, Select, Aggregations, ObjectAfterJoin>;
  RequestForm?: unknown;
};

export type InvoicifyAPI = {
  "/api/users": {
    GET: <
      Include extends InferInclude<GetUsersFn>,
      Select extends InferSelect<GetUsersFn, Include>,
      Aggregations extends GetAggregation<GetUsersFn>,
      ObjectAfterJoin extends GetObjectAfterJoin<GetUsersFn, Include>,
    >() => _api_usersget<Include, Select, Aggregations, ObjectAfterJoin>;
  };
};
