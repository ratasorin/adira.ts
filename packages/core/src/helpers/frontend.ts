import {
  _SelectableFieldsAfterJoin,
  EXECUTOR_KEY,
  EXTRA_KEY,
  ExtractResponseBodyMUTATE,
  ExtractResponseBodyQUERY,
  FilterDefinition,
  GroupByDefinition,
  Leafs,
  SelectableFieldsAfterJoin,
} from "..";
import { ExtractSelect } from "..";
import { PopulatableKeys } from "..";
import { GroupOperationsDefinition } from "..";

export type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type AllKeys<T> = T extends unknown ? keyof T : never;

export type APIMethods<API, R extends keyof API> = keyof API[R] & HTTPMethod;

type StripAPI<Path extends string> = Path extends `/api${infer Rest}`
  ? Rest & string
  : string;

export type PublicAPIPaths<API> = {
  [K in keyof API as StripAPI<K & string>]: K;
};

export type ExtractMetadata<Def, M extends HTTPMethod> =
  // Check method existence
  M extends keyof Def
    ? Def[M] extends { RequestQuery?: infer Q }
      ? Q extends { select?: infer S }
        ? S extends { __base?: infer B; __full?: infer P }
          ? { base: B; full: P } // success
          : { error: "Missing __base or __full metadata in select" }
        : { error: "Missing or malformed select field" }
      : { error: "Missing or malformed RequestQuery field" }
    : { error: "HTTP method not defined on endpoint" };

export type ExtractFull<Metadata> = Metadata extends { full: infer F }
  ? F
  : never;

export type ExtractReqBody<Def, M extends HTTPMethod> = M extends keyof Def
  ? Def[M] extends {
      RequestBody?: infer B;
    }
    ? B
    : Def[M] extends { RequestBody?: infer R }
      ? R
      : undefined
  : never;

export type ExtractQueryParams<
  Def,
  M extends HTTPMethod,
  Include extends any[],
> = M extends keyof Def
  ? Def[M] extends {
      RequestQuery?: infer Q;
    }
    ? Omit<Q, "include" | "select" | "groupBy">
    : never
  : never;

export type ResponseBodyMetadata = {
  [EXECUTOR_KEY]: any;
  [EXTRA_KEY]?: any;
  __full?: any;
  __base?: any;
};

export type ExtractResBody<
  Def,
  M extends HTTPMethod,
  Include extends any[],
  Select extends any[],
  GroupOperations extends GroupOperationsDefinition<any> | undefined =
    undefined,
> = M extends keyof Def
  ? Def[M] extends { ResponseBody?: infer RB }
    ? ResponseBodyMetadata extends Extract<RB, ResponseBodyMetadata>
      ? Extract<RB, ResponseBodyMetadata> extends {
          [EXECUTOR_KEY]: any;
          [EXTRA_KEY]?: infer Extra;
          __populated?: infer Full;
          __base?: infer Base;
        }
        ? M extends "GET"
          ?
              | ExtractResponseBodyQUERY<
                  Full,
                  Base,
                  Include,
                  Select,
                  GroupOperations,
                  Extra
                >
              | Exclude<RB, ResponseBodyMetadata>
          :
              | ExtractResponseBodyMUTATE<Full, Base, Include, Select, Extra>
              | Exclude<RB, ResponseBodyMetadata>
        : {
            error: "Response body metadata missing (__full/__base)";
          }
      : { error: "Malformed ResponseBody" }
    : { error: "Endpoint method has no ResponseBody" }
  : { error: "HTTP method not defined on endpoint" };

export type ExtractReqInclude<Def, M extends HTTPMethod> = M extends keyof Def
  ? Def[M] extends {
      RequestQuery?: infer Q;
    }
    ? Q extends { include: infer I }
      ? I extends { __base?: infer Base }
        ? PopulatableKeys<Base>[]
        : never
      : never
    : never
  : never;

export type ExtractReqSelect<
  Def,
  M extends HTTPMethod,
  Include extends any[],
> = M extends keyof Def
  ? Def[M] extends { RequestQuery?: infer Q }
    ? Q extends { select?: infer S }
      ? S extends { __base?: infer Base }
        ? SelectableFieldsAfterJoin<Base, Include>
        : never
      : never
    : never
  : never;

export type ExtractReqFilter<
  Def,
  M extends HTTPMethod,
  Include extends any[],
> = M extends keyof Def
  ? Def[M] extends {
      RequestQuery?: infer Q;
    }
    ? Q extends { filters?: infer F }
      ? F extends { __base?: infer Base }
        ? FilterDefinition<SelectableFieldsAfterJoin<Base, Include>>
        : { error: "Base type missing in filters" }
      : { error: "filters field missing" }
    : { error: "RequestQuery field missing" }
  : { error: "HTTP method not defined on endpoint" };

export type ExtractReqPath<Def, M extends HTTPMethod> = M extends keyof Def
  ? Def[M] extends {
      RequestPath?: infer PP;
    }
    ? PP
    : Def[M] extends {
          RequestParams?: infer P extends Record<string, string | number>;
        }
      ? P
      : undefined
  : undefined;

export type AxiosApiClient<
  API extends Record<string, Partial<Record<HTTPMethod, any>>>,
> = <
  Metadata extends ExtractMetadata<Endpoint, Method>,
  Full extends ExtractFull<Metadata>,
  PublicPaths extends PublicAPIPaths<API>,
  Path extends keyof PublicPaths,
  Method extends APIMethods<API, PublicPaths[Path] & keyof API>,
  Include extends ExtractReqInclude<Endpoint, Method>,
  Select extends ExtractReqSelect<Endpoint, Method, Include>,
  Where extends ExtractReqFilter<Endpoint, Method, Include>,
  GroupOperations extends GroupOperationsDefinition<Leafs<Full>>,
  Data extends ExtractReqBody<Endpoint, Method>,
  QueryParams extends ExtractQueryParams<Endpoint, Method, Include>,
  PathParam extends ExtractReqPath<Endpoint, Method>,
  Endpoint extends API[keyof API] = API[PublicPaths[Path] & keyof API],
>(
  url: Path,
  method: Method,
  args: {
    query?: Method extends "GET"
      ? {
          include: Include;
          select: Select;
          groupBy: GroupByDefinition<
            ExtractReqSelect<Endpoint, Method, Include>,
            GroupOperations
          >;
          where: Where;
        }
      : never;
    data?: Method extends "GET" ? never : Data;
    path?: PathParam;
  },
) => Promise<
  ExtractResBody<Endpoint, Method, Include, Select, GroupOperations>
>;

export type CreateAxiosApiClient = <
  API extends Record<string, Partial<Record<HTTPMethod, any>>>,
>(
  baseUrl: string,
) => AxiosApiClient<API>;
