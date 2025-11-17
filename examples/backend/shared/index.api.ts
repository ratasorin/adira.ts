import { GetUsersFn } from '../src/controller/users';
import { GetInclude, GetSelect, GetAggregation, GetObjectAfterJoin, GetParams, GetResponseBody } from '@n/adira.backend.ts';
import { ErrorResponse } from '../src/types/index';

export type _api_usersget<Include extends GetInclude<GetUsersFn>, Select extends GetSelect<GetUsersFn, Include>, Aggregations extends GetAggregation<GetUsersFn>, ObjectAfterJoin extends GetObjectAfterJoin<GetUsersFn, Include>> = {
  RequestParams?: any;
  RequestBody?: any;
  ResponseBody?: | ErrorResponse
    | GetResponseBody<GetUsersFn, Include, Select, Aggregations, {}>;
  RequestQuery?: GetParams<Include, Select, Aggregations, ObjectAfterJoin>;
  RequestForm?: unknown;
};

export type InvoicifyAPI = {
  "/api/users": {
    "GET": <Include extends GetInclude<GetUsersFn>, Select extends GetSelect<GetUsersFn, Include>, Aggregations extends GetAggregation<GetUsersFn>, ObjectAfterJoin extends GetObjectAfterJoin<GetUsersFn, Include>>() => _api_usersget<Include, Select, Aggregations, ObjectAfterJoin>;
  };
};
