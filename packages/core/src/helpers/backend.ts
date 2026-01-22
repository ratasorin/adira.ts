import {
  MutationResponse,
  ExecutorQueryResponse,
  ExtractSelect,
  PopulatableKeys,
  PopulateSchema,
  type SchemaAfterJoin,
  type UnionFromTuple,
  SortByDefinition,
  ExecutorQueryParams,
} from "..";
import { PickDistinctDefinition } from "..";
import { AggregateOperation } from "..";
import { WhereDefinition } from "..";
import { Leafs } from "..";

export type InferInclude<Base> = PopulatableKeys<Base>[] & {
  __base?: Base;
};
export type InferSelect<Base, Full> = Leafs<Full>[] & {
  __full?: Full;
  __base?: Base;
};

export type InferWhere<Full> = WhereDefinition<Full>;
export type InferGroupBy<Full> = Leafs<Full>[];
export type InferAggregates<Full> = AggregateOperation<Leafs<Full>, string>[];
export type InferSort<Full> = SortByDefinition<Full>;
export type InferPickDistinct<Full> = PickDistinctDefinition<Full>;

export type InferRequestBody<Handler> = Handler extends {
  __base?: infer Base;
  __method?: infer Method;
}
  ? Method extends "POST"
    ? Omit<Base, "_id">
    : Partial<Omit<Base, "_id">>
  : never;

export type InferHandlerParams<Handler> = Handler extends {
  __base?: infer Base;
  __populated?: infer Populated;
}
  ? ExecutorQueryParams<
      InferInclude<Base>,
      InferSelect<Base, Populated>,
      InferGroupBy<Populated>,
      InferAggregates<Populated>,
      InferWhere<Populated>,
      InferSort<Populated>,
      InferPickDistinct<Populated>
    >
  : {
      error: "Handler is not an executor, check Request's fourth type argument is a InferHandlerParams<ExecutorFn>";
    };

export type InferHandlerResponse<Handler, HandlerExtraWorkReturn> =
  Handler extends {
    __populated?: infer P;
    __base?: infer T;
  }
    ? {
        executor: any;
        extra?: HandlerExtraWorkReturn;
      } & {
        __populated?: P;
        __base?: T;
      }
    : never;

export type NormalizeArray<A, T> = A extends never[] ? T : A;
export type METHOD = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ExecuteGET<T, PSchema = PopulateSchema<T>> = (<
  Include extends PopulatableKeys<T>[],
  Select extends ExtractSelect<T, Include>,
  GroupBy extends Leafs<ObjectAfterJoin>[],
  Aggregates extends AggregateOperation<Leafs<PSchema>, string>[],
  ObjectAfterJoin extends SchemaAfterJoin<T, UnionFromTuple<Include>>,
>(
  params: ExecutorQueryParams<
    Include,
    Select,
    GroupBy,
    Aggregates,
    WhereDefinition<ObjectAfterJoin>,
    SortByDefinition<ObjectAfterJoin>,
    PickDistinctDefinition<ObjectAfterJoin>
  >,
) => Promise<
  ExecutorQueryResponse<T, Include, Select, GroupBy, Aggregates>
>) & {
  __base?: T;
  __populated?: PSchema;
};

export type ExecutePOST<T, PSchema = PopulateSchema<T>> = (<
  NewItem extends Omit<T, "_id">,
  Include extends NormalizeArray<PopulatableKeys<T>[], string[]>,
  Select extends ExtractSelect<T, Include>,
>(
  params: {
    include?: Include;
    select?: Select;
  },
  newItem: NewItem,
) => Promise<MutationResponse<T, Include, Select>>) & {
  __base?: T;
  __populated?: PSchema;
  __method?: "POST";
};
export type ExecutePATCH<T, PSchema = PopulateSchema<T>> = (<
  NewItem extends Partial<Omit<T, "_id">>,
  Include extends NormalizeArray<PopulatableKeys<T>[], string[]>,
  Select extends ExtractSelect<T, Include>,
>(
  id: string,
  params: {
    include?: Include;
    select?: Select;
  },
  newItem: NewItem,
  config: {
    createNewRecord?: boolean;
  },
) => Promise<MutationResponse<T, Include, Select>>) & {
  __base?: T;
  __populated?: PSchema;
  __method?: "PATCH";
};
export type ExecuteDELETE<T, PSchema = PopulateSchema<T>> = (<
  Include extends NormalizeArray<PopulatableKeys<T>[], string[]>,
  Select extends ExtractSelect<T, Include>,
>(
  id: string,
  params: {
    include?: Include;
    select?: Select;
  },
  config: {
    softDelete?: () => any;
  },
) => Promise<MutationResponse<T, Include, Select>[]>) & {
  __base?: T;
  __populated?: PSchema;
};
export type ExecutorReturnType<T, Method extends METHOD> = Method extends "GET"
  ? ExecuteGET<T>
  : Method extends "POST"
    ? ExecutePOST<T>
    : Method extends "PATCH"
      ? ExecutePATCH<T>
      : Method extends "DELETE"
        ? ExecuteDELETE<T>
        : never;
