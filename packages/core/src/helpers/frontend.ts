import {
  SchemaAfterJoin,
  EXECUTOR_KEY,
  RELATED_KEY,
  MutationResponse,
  QueryResponse,
  TupleToUnion,
  ExecutorQueryParams,
  RowIntent,
} from "..";
import { PopulatableKeys } from "..";
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
  Endpoint,
  Method extends HTTPMethod,
> = Method extends keyof Endpoint
  ? Endpoint[Method] extends { ResponseBody?: infer RB }
    ? RB
    : never
  : never;

export type AxiosApiClientQuery<
  API extends Record<string, Partial<Record<HTTPMethod, any>>>,
  Path extends keyof PublicAPIPaths<API> & string,
  ResponseBody,
> = <
  Method extends "GET",
  BaseQuery extends ExtractQuery<Endpoint, Method>,
  Base extends ExtractBase<BaseQuery>,
  const Include extends PopulatableKeys<Base>[],
  const Full extends SchemaAfterJoin<Base, TupleToUnion<Include>>,
  const Rows extends RowIntent<string[], any, any>,
  PathParam extends ExtractReqPath<Endpoint, Method>,
  const Groups extends Record<string, any> | undefined = undefined,
  Endpoint extends API[PublicAPIPaths<API>[Path] & keyof API] =
    API[PublicAPIPaths<API>[Path] & string],
>(
  params: {
    query: ExecutorQueryParams<Full, Include, Rows, Groups>;
  } & ([PathParam] extends [never] ? {} : { path: PathParam }),
) => Promise<
  HydrateResponse<ResponseBody, Method, Include, Rows["select"], Groups>
>;

export type AxiosApiClientMutate<
  API extends Record<string, Partial<Record<HTTPMethod, any>>>,
  Path extends keyof PublicAPIPaths<API> & string,
  Method extends "POST" | "PATCH" | "DELETE",
  ResponseBody,
> = <
  Data extends ExtractReqBody<Endpoint, Method>,
  PathParam extends ExtractReqPath<Endpoint, Method>,
  PublicPaths extends PublicAPIPaths<API>,
  Endpoint extends API[keyof API] = API[PublicPaths[Path] & keyof API],
>(
  data: Data,
  path?: PathParam,
) => Promise<HydrateResponse<ResponseBody, Method, [], [], {}>>;

export type CreateAxiosApiClient = <
  API extends Record<string, Partial<Record<HTTPMethod, any>>>,
>(
  baseUrl: string,
  __?: API,
) => <
  PublicPaths extends PublicAPIPaths<API>,
  Path extends keyof PublicPaths & string,
  Method extends HTTPMethod,
  ResponseBody extends ExtractResBody<Endpoint, Method>,
  Endpoint extends API[PublicPaths[Path] & keyof API] = API[PublicPaths[Path] &
    keyof API],
>(
  path: Path,
  method: Method,
) => ExtractResponseMetadata<ResponseBody> extends never
  ? ResponseBody
  : AxiosApiClientQuery<API, Path, ResponseBody>;

export {};
