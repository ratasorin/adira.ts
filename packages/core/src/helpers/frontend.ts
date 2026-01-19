import {
  SchemaAfterJoin,
  EXECUTOR_KEY,
  EXTRA_KEY,
  ExtractResponseBodyMUTATE,
  ExtractResponseBodyQUERY,
  FilterDefinition,
  GroupByDefinition,
  Leafs,
  SelectableFieldsAfterJoin,
  UnionFromTuple,
} from "..";
import { PopulatableKeys } from "..";
import { GroupOperationsDefinition } from "..";
export type HTTPMethod = "GET" | "POST" | "PATCH" | "DELETE";
export type AllKeys<T> = T extends unknown ? keyof T : never;
export type APIMethods<API, R extends keyof API> = keyof API[R] & HTTPMethod;
type StripAPI<Path extends string> = Path extends `/api${infer Rest}`
  ? Rest & string
  : string;
export type PublicAPIPaths<API> = {
  [K in keyof API as StripAPI<K & string>]: K;
};
export type ExtractMetadata<Def, M extends HTTPMethod> = M extends keyof Def
  ? Def[M] extends {
      RequestQuery?: infer Q;
    }
    ? Q extends {
        select?: infer S;
      }
      ? S extends {
          __base?: infer B;
          __full?: infer P;
        }
        ? {
            base: B;
            full: P;
          }
        : {
            error: "Missing __base or __full metadata in select";
          }
      : {
          error: "Missing or malformed select field";
        }
    : {
        error: "Missing or malformed RequestQuery field";
      }
  : {
      error: "HTTP method not defined on endpoint";
    };
export type ExtractFull<Metadata> = Metadata extends {
  full: infer F;
}
  ? F
  : never;
export type ExtractBase<Metadata> = Metadata extends {
  base: infer B;
}
  ? B
  : never;
export type ExtractReqBody<Def, M extends HTTPMethod> = M extends keyof Def
  ? Def[M] extends {
      RequestBody?: infer B;
    }
    ? B
    : Def[M] extends {
          RequestBody?: infer R;
        }
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
  ? Def[M] extends {
      ResponseBody?: infer RB;
    }
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
      : {
          error: "Malformed ResponseBody";
        }
    : {
        error: "Endpoint method has no ResponseBody";
      }
  : {
      error: "HTTP method not defined on endpoint";
    };
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
export type AxiosApiClientQuery<
  API extends Record<string, Partial<Record<HTTPMethod, any>>>,
  Path extends keyof PublicAPIPaths<API>,
> = <
  Method extends "GET",
  Metadata extends ExtractMetadata<Endpoint, Method>,
  Base extends ExtractBase<Metadata>,
  Include extends PopulatableKeys<Base>[],
  Full extends SchemaAfterJoin<Base, UnionFromTuple<Include>>,
  Select extends Leafs<Full>[],
  GroupOperations extends GroupOperationsDefinition<Leafs<Full>>,
  PathParam extends ExtractReqPath<Endpoint, Method>,
  Where extends FilterDefinition<Full>,
  PublicPaths extends PublicAPIPaths<API>,
  Endpoint extends API[keyof API] = API[PublicPaths[Path] & keyof API],
>(
  query: {
    include: Include;
    select: Select;
    groupBy?: GroupByDefinition<
      SelectableFieldsAfterJoin<Base, Include>,
      GroupOperations
    >;
    where?: Where;
  },
  path?: PathParam,
) => Promise<
  ExtractResBody<Endpoint, Method, Include, Select, GroupOperations>
>;
export type AxiosApiClientMutate<
  API extends Record<string, Partial<Record<HTTPMethod, any>>>,
  Path extends keyof PublicAPIPaths<API>,
  Method extends "POST" | "PATCH" | "DELETE",
> = <
  Data extends ExtractReqBody<Endpoint, Method>,
  PathParam extends ExtractReqPath<Endpoint, Method>,
  PublicPaths extends PublicAPIPaths<API>,
  Endpoint extends API[keyof API] = API[PublicPaths[Path] & keyof API],
>(
  data: Data,
  path?: PathParam,
) => Promise<ExtractResBody<Endpoint, Method, [], [], undefined>>;
export type CreateAxiosApiClient = <
  API extends Record<string, Partial<Record<HTTPMethod, any>>>,
>(
  baseUrl: string,
  __?: API,
) => <
  PublicPaths extends PublicAPIPaths<API>,
  Path extends keyof PublicPaths,
  Method extends HTTPMethod,
>(
  path: Path,
  method: Method,
) => Method extends "GET"
  ? AxiosApiClientQuery<API, Path & string>
  : AxiosApiClientMutate<API, Path & string, Exclude<Method, "GET">>;
export {};
