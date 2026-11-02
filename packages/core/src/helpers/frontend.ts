import {
  SchemaAfterJoin,
  RELATED_KEY,
  MutationResponse,
  QueryResponse,
  TupleToUnion,
  ExecutorQueryParams,
  RowIntent,
  RowHelper,
  GroupIntent,
  AggregateOperation,
} from "..";
import { PopulatableKeys } from "..";
import type {
  ExactReadQuery,
  ExecutedRead,
  ReadQuery,
  ReadResponse,
  ResourceLike,
  ResourceOfResponse,
} from "../read";
export type HTTPMethod = "GET" | "POST" | "PATCH" | "DELETE";
export type AllKeys<T> = T extends unknown ? keyof T : never;

export type EndpointMethods<Endpoint> = keyof Endpoint;

export type APIDefinition = Record<
  string,
  Partial<Record<HTTPMethod, unknown>>
>;
type ResponseGroups = Record<
  string,
  GroupIntent<string[], AggregateOperation<string, string>[], unknown>
>;

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

export type ResponseBodyMetadata = { __base?: unknown; __related?: unknown };

type ExtractResponseMetadata<T> = T extends object
  ? "__base" extends keyof T
    ? T extends { __base?: infer B; __related?: infer R }
      ? { base: B; [RELATED_KEY]: R }
      : never
    : never
  : never;

type WithoutLegacyResponse<T> = T extends object
  ? "__base" extends keyof T
    ? never
    : T
  : T;

export type HydrateResponse<
  RB,
  Method,
  Include extends string[],
  Select extends string[],
  Groups extends ResponseGroups | undefined,
> =
  ExtractResponseMetadata<RB> extends { base: infer B; [RELATED_KEY]: infer E }
    ? Method extends "GET"
      ? QueryResponse<B, Include, Select, Groups, E> | WithoutLegacyResponse<RB>
      : Method extends "DELETE"
        ? MutationResponse<B, Include, Select, E>[] | WithoutLegacyResponse<RB>
        : MutationResponse<B, Include, Select, E> | WithoutLegacyResponse<RB>
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

type HydrateResourceResponse<
  R extends ResourceLike,
  Q,
  Response,
> = Response extends unknown
  ? [ResourceOfResponse<Response>] extends [never]
    ? Response
    : ReadResponse<R, Q> & Omit<Response, keyof ExecutedRead<R> | "__resource">
  : never;
type ResourceQueryFunction<R extends ResourceLike, ResponseBody, Path> = <
  const Q extends ReadQuery<R>,
>(
  params: { query: Q & ExactReadQuery<R, Q> } & ([Path] extends [never]
    ? {}
    : { path: Path }),
) => {
  run: () => Promise<HydrateResourceResponse<R, Q, ResponseBody>>;
};

export type AxiosApiClientQuery<
  API extends APIDefinition,
  InternalPath extends keyof APIDefinition,
  Method extends HTTPMethod = "GET",
  Endpoints = API[InternalPath & keyof API],
  ResponseBody = ExtractResBody<Endpoints, Method>,
  Query = ExtractQuery<Endpoints, Method>,
  Base = ExtractBase<Query>,
  PathParam = ExtractReqPath<Endpoints, Method>,
> = [ResourceOfResponse<ResponseBody>] extends [never]
  ? [ExtractResponseMetadata<ResponseBody>] extends [never]
    ? (params: AxiosQueryFunctionParams<Query, PathParam>) => {
        run: () => Promise<ResponseBody>;
      }
    : <
        const Include extends PopulatableKeys<Base>[],
        const Full extends SchemaAfterJoin<Base, TupleToUnion<Include>>,
        const Rows extends RowIntent<string[], unknown, unknown>,
        const Groups extends ResponseGroups | undefined = undefined,
      >(
        params: {
          query: ExecutorQueryParams<Full, Include, Rows, Groups>;
        } & ([PathParam] extends [never] ? {} : { path: PathParam }),
      ) => {
        run: () => Promise<
          HydrateResponse<ResponseBody, Method, Include, Rows["select"], Groups>
        >;
      }
  : ResourceQueryFunction<
      ResourceOfResponse<ResponseBody>,
      ResponseBody,
      PathParam
    >;

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
      const Rows extends RowIntent<string[], unknown, unknown>,
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
