import {
  MutationResponse,
  ExecutorQueryResponse,
  ExtractSelect,
  PopulatableKeys,
  PopulateSchema,
  type SchemaAfterJoin,
  type TupleToUnion,
  SortByDefinition,
  RowIntent,
  GroupIntent,
  EXECUTOR_KEY,
  RELATED_KEY,
  ExecutorQueryParams,
} from "..";
import { PickDistinctDefinition } from "..";
import { AggregateOperation } from "..";
import { WhereDefinition } from "..";
import { Leafs } from "..";

export type InferInclude<Base> = PopulatableKeys<Base>[] & {
  __base?: Base;
};

export type InferSelect<Full> = Leafs<Full>[];
export type InferWhere<Full> = WhereDefinition<Full>;
export type InferGroupBy<Full> = Leafs<Full>[];
export type InferAggregates<Full> = AggregateOperation<Leafs<Full>, string>[];
export type InferSort<Full> = SortByDefinition<Full>;
export type InferPickDistinct<Full> = PickDistinctDefinition<Full>;

export type InferRows<Full> = RowIntent<
  InferSelect<Full>,
  InferSort<Full>,
  InferPickDistinct<Full>
>;

export type InferGroups<Full> = Record<
  string,
  GroupIntent<InferGroupBy<Full>, InferAggregates<Full>, InferSort<Full>>
>;

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
}
  ? ExecutorQueryParams<
      PopulateSchema<Base>,
      InferInclude<Base>,
      InferRows<PopulateSchema<Base>>,
      InferGroups<PopulateSchema<Base>>
    >
  : {
      error: "Handler is not an executor, check Request's fourth type argument is a InferHandlerParams<ExecutorFn>";
    };

export type InferHandlerResponse<
  Handler,
  HandlerExtraWork = undefined,
> = Handler extends {
  __base?: infer T;
}
  ? {
      [EXECUTOR_KEY]: any;
      [RELATED_KEY]?: HandlerExtraWork;
      __base?: T;
    }
  : never;

export type NormalizeArray<A, T> = A extends never[] ? T : A;
export type METHOD = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ExecuteGET<T, V extends Record<string, unknown> = {}> = (<
  Include extends PopulatableKeys<T>[],
  ObjectAfterJoin extends SchemaAfterJoin<T, TupleToUnion<Include>>,
  Select extends ExtractSelect<T, Include>,
  SortBy extends SortByDefinition<ObjectAfterJoin>,
  PickDistinct extends PickDistinctDefinition<ObjectAfterJoin>,
  Rows extends RowIntent<Select, SortBy, PickDistinct>,
  Groups extends Record<
    string,
    GroupIntent<
      Leafs<ObjectAfterJoin>[],
      AggregateOperation<Leafs<ObjectAfterJoin>, string>[],
      SortByDefinition<Leafs<ObjectAfterJoin>>
    >
  >,
>(
  params: ExecutorQueryParams<ObjectAfterJoin, Include, Rows, Groups>,
) => Promise<ExecutorQueryResponse<T, Include, Select, Groups>>) & {
  __base?: T;
};

export type ExecutePOST<T> = (<
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
  __method?: "POST";
};
export type ExecutePATCH<T> = (<
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
  __method?: "PATCH";
};
export type ExecuteDELETE<T> = (<
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
};
