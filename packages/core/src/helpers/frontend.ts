import { ExtractResponseBodySingle } from "..";
import { ExtractSelect } from "..";
import { PopulatableKeys } from "..";
import { ExtractResponseBodyArray } from "..";
import { GroupOperationsDefinition } from "..";

export type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type AllKeys<T> = T extends unknown ? keyof T : never;

export type APIMethods<API, R extends string> = AllKeys<API[R & keyof API]>;

type StripAPI<Path extends string> = Path extends `/api${infer Rest}`
  ? Rest
  : never;

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

export type ExtractQueryParams<Def, M extends HTTPMethod> = M extends keyof Def
  ? Def[M] extends {
      RequestQuery?: infer Q;
    }
    ? Omit<Q, "include" | "select" | "groupBy">
    : never
  : never;

export type ResponseBodyMetadata = {
  executor?: any;
  extra?: any;
  __full?: any;
  __base?: any;
  __extra?: any;
  __array?: any;
};

export type ExtractResBody<
  Def,
  M extends HTTPMethod,
  Include extends any[],
  Select extends any[],
  GroupOperations extends
    | GroupOperationsDefinition<any>
    | undefined = undefined,
> = M extends keyof Def
  ? Def[M] extends { ResponseBody?: infer RB }
    ? Extract<RB, ResponseBodyMetadata> extends {
        __full?: infer Full;
        __base?: infer Base;
        __extra?: infer Extra;
        __array?: infer IsArray;
      }
      ? IsArray extends true
        ? ExtractResponseBodyArray<
            Full,
            Base,
            Include,
            Select,
            GroupOperations,
            Extra
          > &
            Exclude<RB, ResponseBodyMetadata>
        : // SINGLE RESPONSE
          ExtractResponseBodySingle<
            Full,
            Base,
            Include,
            Select,
            GroupOperations,
            Extra
          > &
            Exclude<RB, ResponseBodyMetadata>
      : {
          error: "Response body metadata missing (__full/__base/__extra/__array)";
        }
    : { error: "Malformed ResponseBody" }
  : { error: "Endpoint method is not a function and has no ResponseBody" };

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
      ? S extends { __full?: infer Full; __base?: infer Base }
        ? ExtractSelect<Full, Base, Include>
        : never
      : never
    : never
  : never;

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
