import {
  SchemaAfterJoin,
  EXECUTOR_KEY,
  RELATED_KEY,
  MutationResponse,
  QueryResponse,
  TupleToUnion,
  ExecutorQueryParams,
  RowIntent,
  RowHelper,
} from "..";
import { PopulatableKeys } from "..";
export type HTTPMethod = "GET" | "POST" | "PATCH" | "DELETE";
export type AllKeys<T> = T extends unknown ? keyof T : never;

export type EndpointMethods<Endpoint> = keyof Endpoint;

export type APIDefinition = Record<string, Partial<Record<HTTPMethod, any>>>;

type StripAPI<Path extends string> = Path extends `/api${infer Rest}`
  ? Rest & string
  : string;

export type PublicPathMap<API> = {
  [K in keyof API as StripAPI<K & string>]: K;
};

export type PublicRoute<PathMap> = keyof PathMap & string;

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

type ExtractResponseMetadata<T> = T extends {
  __base?: infer B;
  [RELATED_KEY]?: infer R;
}
  ? { base: B; [RELATED_KEY]: R }
  : never;

export type HydrateResponse<
  RB,
  Method,
  Include extends string[],
  Select extends string[],
  Groups extends Record<string, any> | undefined,
> =
  ExtractResponseMetadata<RB> extends { base: infer B; [RELATED_KEY]: infer E }
    ? Method extends "GET"
      ?
          | QueryResponse<B, Include, Select, Groups, E>
          | Exclude<RB, ResponseBodyMetadata>
      :
          | MutationResponse<B, Include, Select, E>
          | Exclude<RB, ResponseBodyMetadata>
    : { error: "Response body metadata missing __base" };

export type ExtractReqPath<Def, M extends HTTPMethod> = M extends keyof Def
  ? Def[M] extends {
      RequestPath?: infer PP;
    }
    ? PP
    : never
  : never;

export type ExtractResBody<
  Endpoints,
  Method extends HTTPMethod,
> = Method extends keyof Endpoints
  ? Endpoints[Method] extends { ResponseBody?: infer RB }
    ? RB
    : never
  : never;

export type AxiosQueryFunctionParams<Query, Path> = { query: Query } & ([
  Path,
] extends [never]
  ? {}
  : { path: Path });

export type AxiosApiClientQuery<
  API extends APIDefinition,
  InternalPath extends keyof APIDefinition,
  Method extends HTTPMethod = "GET",
  Endpoints = API[InternalPath & keyof API],
  ResponseBody = ExtractResBody<Endpoints, Method>,
  Query = ExtractQuery<Endpoints, Method>,
  Base = ExtractBase<Query>,
  PathParam = ExtractReqPath<Endpoints, Method>,
> = [ExtractResponseMetadata<ResponseBody>] extends [never]
  ? (params: AxiosQueryFunctionParams<Query, PathParam>) => {
      run: () => Promise<ResponseBody>;
    }
  : <
      const Include extends PopulatableKeys<Base>[],
      const Full extends SchemaAfterJoin<Base, TupleToUnion<Include>>,
      const Rows extends RowIntent<string[], any, any>,
      const Groups extends Record<string, any> | undefined = undefined,
    >(
      params: {
        query: ExecutorQueryParams<Full, Include, Rows, Groups>;
      } & ([PathParam] extends [never] ? {} : { path: PathParam }),
    ) => {
      run: () => Promise<
        HydrateResponse<ResponseBody, Method, Include, Rows["select"], Groups>
      >;
    };

export type AxiosApiClientMutate<
  API extends APIDefinition,
  InternalPath extends keyof API,
  Method extends "POST" | "PATCH" | "DELETE",
  Endpoints = API[InternalPath & keyof API],
  ResponseBody = ExtractResBody<Endpoints, Method>,
  Data = ExtractReqBody<Endpoints, Method>,
  PathParam = ExtractReqPath<Endpoints, Method>,
  Query = ExtractQuery<Endpoints, Method>,
  Base = ExtractBase<Query>,
> = [ExtractResponseMetadata<ResponseBody>] extends [never]
  ? (
      params: { data: Data } & ([PathParam] extends [never]
        ? {}
        : { path: PathParam }),
    ) => { run: () => Promise<ResponseBody> }
  : <
      const Include extends PopulatableKeys<Base>[],
      const Rows extends RowIntent<string[], any, any>,
    >(
      params: {
        data: Data;
        // Mutations support 'include' and 'select' for the returned record
        query?: {
          include?: Include;
          rows?: (
            r: RowHelper<SchemaAfterJoin<Base, TupleToUnion<Include>>>,
          ) => Rows;
        };
      } & ([PathParam] extends [never] ? {} : { path: PathParam }),
    ) => {
      run: () => Promise<
        // Mutations return hydrated records, but usually no groups
        HydrateResponse<ResponseBody, Method, Include, Rows["select"], {}>
      >;
    };

export type CreateAxiosApiClient = <API extends APIDefinition>(
  baseUrl: string,
  __?: API,
) => <
  PathsMap extends PublicPathMap<API>,
  PublicPath extends PublicRoute<PathsMap>,
  Method extends EndpointMethods<Endpoints>,
  InternalPath = PathsMap[PublicPath],
  Endpoints = API[InternalPath & keyof API],
>(
  path: PublicPath,
  method: Method,
) => Method extends "GET"
  ? AxiosApiClientQuery<API, InternalPath & string>
  : AxiosApiClientMutate<
      API,
      InternalPath & string,
      Exclude<Method & HTTPMethod, "GET">
    >;

export {};
