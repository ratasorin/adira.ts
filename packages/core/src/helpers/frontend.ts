import {
  SchemaAfterJoin,
  EXECUTOR_KEY,
  RELATED_KEY,
  MutationResponse,
  QueryResponse,
  WhereDefinition,
  Leafs,
  UnionFromTuple,
  ExecutorQueryParams,
  SortByDefinition,
  PickDistinctDefinition,
  DefineGroupFn,
  GroupIntent,
  ExtractNewFieldsFromAggregates,
} from "..";
import { PopulatableKeys } from "..";
import { AggregateOperation } from "..";
export type HTTPMethod = "GET" | "POST" | "PATCH" | "DELETE";
export type AllKeys<T> = T extends unknown ? keyof T : never;
export type APIMethods<API, R extends keyof API> = keyof API[R] & HTTPMethod;
type StripAPI<Path extends string> = Path extends `/api${infer Rest}`
  ? Rest & string
  : string;

export type PublicAPIPaths<API> = {
  [K in keyof API as StripAPI<K & string>]: K;
};

export type ExtractQuery<
  Endpoint,
  M extends HTTPMethod,
> = M extends keyof Endpoint
  ? Endpoint[M] extends {
      RequestQuery?: infer Q;
    }
    ? Q
    : never
  : never;

export type ExtractBase<Query> = Query extends {
  include?: infer I;
}
  ? I extends {
      __base?: infer B;
    }
    ? B
    : null
  : null;

export type ExtractReqBody<Def, M extends HTTPMethod> = M extends keyof Def
  ? Def[M] extends {
      RequestBody?: infer RB;
    }
    ? RB
    : never
  : never;

export type ResponseBodyMetadata = {
  [EXECUTOR_KEY]: any;
  [RELATED_KEY]?: any;
  __base?: any;
};

type ResponseMetadata<T> = T extends ResponseBodyMetadata & {
  __base: infer B;
  [RELATED_KEY]?: infer E;
}
  ? { base: B; extra: E }
  : never;

export type ExtractDehydratedResBody<
  RB,
  Method,
  Include extends any[],
  Select extends any[],
  Groups extends Record<string, any>, 
> = ResponseMetadata<RB> extends { base: infer B; extra: infer E }
    ? Method extends "GET"
      ?
          | QueryResponse<B, Include, Select, Groups, E>
          | Exclude<RB, ResponseBodyMetadata>
      :
          | MutationResponse<B, Include, Select, E>
          | Exclude<RB, ResponseBodyMetadata>
    : { error: "Response body metadata missing __base" };


    export type ExtractSimpleResBody<> = {};

  

type EndpointNeedsHydration<Endpoint extends Partial<Record<HTTPMethod, any>>> =
  Endpoint["GET"] extends {
    ResponseBody: infer RB;
  }
    ? ResponseMetadata<RB> extends never
      ? false
      : true
    : never;

export type ExtractReqPath<Def, M extends HTTPMethod> = M extends keyof Def
  ? Def[M] extends {
      RequestPath?: infer PP;
    }
    ? PP
    : never
  : never;

  export type ExtractResBody<
  Endpoint,
  Method extends HTTPMethod> = Method extends keyof Endpoint
    ? Endpoint[Method] extends { ResponseBody?: infer RB }
      ? RB : never
    : never;

// The helper function type that will be passed into the callback
type GroupHelper<Full> = <
  const Aggs extends AggregateOperation<Leafs<Full>, string>[],
  const By extends Leafs<Full>[],
>(group: {
  by: By,
  aggregates: Aggs,
  sortBy?: SortByDefinition<Leafs<Full> | ExtractNewFieldsFromAggregates<Aggs>>,
  limit?: number
}) => typeof group;

export type AxiosApiClientQuery<
  API extends Record<string, Partial<Record<HTTPMethod, any>>>,
  Path extends keyof PublicAPIPaths<API> & string,
  ResponseBody
> = <
  Method extends "GET",
  Query extends ExtractQuery<Endpoint, Method>,
  Base extends ExtractBase<Query>,
  Include extends PopulatableKeys<Base>[],
  Full extends SchemaAfterJoin<
    Base,
    UnionFromTuple<Include>
  >,
  Select extends Leafs<Full>[],
  PathParam extends ExtractReqPath<Endpoint, Method>,
  Where extends WhereDefinition<Full>,
  PublicPaths extends PublicAPIPaths<API>,
  Groups,
  PickDistinct extends PickDistinctDefinition<Full>,
  Endpoint extends API[keyof API] = API[PublicPaths[Path] & keyof API],
>(
  query: ExecutorQueryParams<
    Include,
    Where,
    Select,
    SortByDefinition<Leafs<Full>>,
    PickDistinct,
    any[],
    Full
  > & {
     groups?: (g: GroupHelper<Full>) => Groups;
  },
  path?: PathParam,
) => Promise<ExtractDehydratedResBody<ResponseBody, Method, Include, Select, Groups>>;

export type AxiosApiClientMutate<
  API extends Record<string, Partial<Record<HTTPMethod, any>>>,
  Path extends keyof PublicAPIPaths<API> & string,
  Method extends "POST" | "PATCH" | "DELETE",
  ResponseBody
> = <
  Data extends ExtractReqBody<Endpoint, Method>,
  PathParam extends ExtractReqPath<Endpoint, Method>,
  PublicPaths extends PublicAPIPaths<API>,
  Endpoint extends API[keyof API] = API[PublicPaths[Path] & keyof API],
>(
  data: Data,
  path?: PathParam,
) => Promise<ExtractDehydratedResBody<ResponseBody, Method, [], [], {}>>;

export type CreateAxiosApiClient = <
  API extends Record<string, Partial<Record<HTTPMethod, any>>>,
>(
  baseUrl: string,
  __?: API,
) => <
  PublicPaths extends PublicAPIPaths<API>,
  Path extends keyof PublicPaths & string,
  Method extends HTTPMethod,
  ResponseBody extends ExtractResBody<
    Endpoint,
    Method>,
  Endpoint extends API[PublicPaths[Path] & keyof API] = API[PublicPaths[Path] &
    keyof API],
>(
  path: Path,
  method: Method,
) => AxiosApiClientQuery<API, Path, ResponseBody>

export {};
