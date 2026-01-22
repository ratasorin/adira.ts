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
  RowIntent,
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

export type ExtractQuery<Def, M extends HTTPMethod> = M extends keyof Def
  ? Def[M] extends {
      RequestQuery?: infer Q;
    }
    ? Q
    : never
  : never;

export type ExtractExecutorMetadata<Query> = Query extends {
  include?: infer I;
}
  ? I extends {
      __base?: infer B;
    }
    ? {
        base: B;
      }
    : null
  : null;

export type ExtractFull<Metadata> = Metadata extends {
  full: infer F;
}
  ? F
  : never;
export type ProjectedShape<Metadata> = Metadata extends {
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

export type ResponseBodyMetadata = {
  [EXECUTOR_KEY]: any;
  [RELATED_KEY]?: any;
  __full?: any;
  __base?: any;
};
export type ExtractResBody<
  Def,
  M extends HTTPMethod,
  Include extends any[],
  Select extends any[],
  GroupBy extends any[],
  Aggregates extends AggregateOperation<any, any>[] | undefined = undefined,
> = M extends keyof Def
  ? Def[M] extends {
      ResponseBody?: infer RB;
    }
    ? ResponseBodyMetadata extends Extract<RB, ResponseBodyMetadata>
      ? Extract<RB, ResponseBodyMetadata> extends {
          [EXECUTOR_KEY]: any;
          [RELATED_KEY]?: infer Extra;
          __base?: infer Base;
        }
        ? M extends "GET"
          ?
              | QueryResponse<Base, Include, Select, GroupBy, Aggregates, Extra>
              | Exclude<RB, ResponseBodyMetadata>
          :
              | MutationResponse<Base, Include, Select, Extra>
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
  Path extends keyof PublicAPIPaths<API> & string,
> = <
  Method extends "GET",
  Query extends ExtractQuery<Endpoint, Method>,
  ExecutorMetadata extends ExtractExecutorMetadata<Query>,
  Base extends ProjectedShape<ExecutorMetadata>,
  Include extends PopulatableKeys<Base>[],
  Full extends SchemaAfterJoin<Base, UnionFromTuple<Include>>,
  Select extends Leafs<Full>[],
  As extends string,
  Aggregates extends AggregateOperation<Leafs<Full>, As>[],
  PathParam extends ExtractReqPath<Endpoint, Method>,
  Where extends WhereDefinition<Full>,
  PublicPaths extends PublicAPIPaths<API>,
  PickDistinct extends PickDistinctDefinition<Full>,
  SortBy extends SortByDefinition<Full>,
  GroupBy extends Leafs<Full>[],
  Endpoint extends API[keyof API] = API[PublicPaths[Path] & keyof API],
>(
  query: ExecutorQueryParams<
    Include,
    Where,
    {
      select: Select;
      sortBy?: SortByDefinition<Leafs<Full>>;
      pickDistinct?: PickDistinct;
      limit?: number;
      offset?: number;
    },
    {
      [K: string]: {
        by: GroupBy;
        aggregates: Aggregates;
        sortBy: SortByDefinition<Leafs<Full>> &
          SortByDefinition<ExtractNewFieldsFromAggregates<Aggregates>>;
      };
    }
  >,
  path?: PathParam,
) => Promise<
  ExtractResBody<Endpoint, Method, Include, Select, GroupBy, Aggregates>
>;
export type AxiosApiClientMutate<
  API extends Record<string, Partial<Record<HTTPMethod, any>>>,
  Path extends keyof PublicAPIPaths<API> & string,
  Method extends "POST" | "PATCH" | "DELETE",
> = <
  Data extends ExtractReqBody<Endpoint, Method>,
  PathParam extends ExtractReqPath<Endpoint, Method>,
  PublicPaths extends PublicAPIPaths<API>,
  Endpoint extends API[keyof API] = API[PublicPaths[Path] & keyof API],
>(
  data: Data,
  path?: PathParam,
) => Promise<ExtractResBody<Endpoint, Method, [], [], [], undefined>>;
export type CreateAxiosApiClient = <
  API extends Record<string, Partial<Record<HTTPMethod, any>>>,
>(
  baseUrl: string,
  __?: API,
) => <
  PublicPaths extends PublicAPIPaths<API>,
  Path extends keyof PublicPaths & string,
  Method extends HTTPMethod,
>(
  path: Path,
  method: Method,
) => Method extends "GET"
  ? AxiosApiClientQuery<API, Path>
  : AxiosApiClientMutate<API, Path, Exclude<Method, "GET">>;
export {};
