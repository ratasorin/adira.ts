import {
  ExtractResponseMUTATE,
  ExtractResponseQUERY,
  ExtractSelect,
  GroupByDefinition,
  PopulatableKeys,
  PopulateSchema,
  SelectableFieldsAfterJoin,
} from "..";
import { SortByDefinition } from "..";
import { RowsPrunerDefiniton } from "..";
import { GroupOperationsDefinition } from "..";
import { FilterDefinition } from "..";
import { Leafs } from "..";

export type InferInclude<Base> = PopulatableKeys<Base>[] & { __base?: Base };

export type InferSelect<Base, Full> = Leafs<Full>[] & {
  __full?: Full;
  __base?: Base;
};

export type InferFilter<Base, Full> = FilterDefinition<Full> & {
  __full?: Full;
  __base?: Base;
};

export type InferGroupBy<Base, Full> = GroupByDefinition<
  Leafs<Full>[],
  GroupOperationsDefinition<Leafs<Full>>[]
> & {
  __full?: Full;
  __base?: Base;
};

export type InferSort<Base, Full> = SortByDefinition<Full> & {
  __full?: Full;
  __base?: Base;
};

export type InferRowPruner<Base, Full> = RowsPrunerDefiniton<Full> & {
  __base?: Base;
  __full?: Full;
};

export type InferHandlerParams<Handler> = "__base" extends keyof Handler
  ? "__populated" extends keyof Handler
    ? Handler extends {
        __base?: infer Base;
        __populated?: infer Populated;
      }
      ? {
          include: InferInclude<Base>;
          select: InferSelect<Base, Populated>;
          limit?: number;
          offset?: number;
          filters?: InferFilter<Base, Populated>;
          groupBy?: InferGroupBy<Base, Populated>;
          sort?: InferSort<Base, Populated>;
          prune?: InferRowPruner<Base, Populated>;
        }
      : {
          error: "Handler is not an executor, check Request's fourth type argument is a InferHandlerParams<ExecutorFn>";
        }
    : {
        error: "Handler is not an executor, check Request's fourth type argument is a InferHandlerParams<ExecutorFn>";
      }
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

export type InferExecutorParams<
  Include extends any[],
  Select extends any[],
  GroupOperations extends any[],
  ObjectAfterJoin,
> = {
  include: Include;
  select: Select;
  limit?: number;
  offset?: number;
  filters?: FilterDefinition<ObjectAfterJoin>;
  groupBy?: GroupByDefinition<Leafs<ObjectAfterJoin>[], GroupOperations[]>;
  sort?: SortByDefinition<ObjectAfterJoin>;
  prune?: RowsPrunerDefiniton<ObjectAfterJoin>;
};

export type NormalizeArray<A, T> = A extends never[] ? T : A;

export type METHOD = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ExecuteGET<T, PSchema = PopulateSchema<T>> = (<
  Include extends PopulatableKeys<T>[],
  Select extends ExtractSelect<T, Include>,
  GroupOperations extends GroupOperationsDefinition<Leafs<PSchema>>,
  ObjectAfterJoin extends SelectableFieldsAfterJoin<T, Include>,
>(
  params: InferExecutorParams<
    Include,
    Select,
    GroupOperations,
    ObjectAfterJoin
  >,
) => Promise<
  ExtractResponseQUERY<PSchema, T, Include, Select, GroupOperations>
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
) => Promise<ExtractResponseMUTATE<PSchema, T, Include, Select>>) & {
  __base?: T;
  __populated?: PSchema;
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
) => Promise<ExtractResponseMUTATE<PSchema, T, Include, Select>>) & {
  __base?: T;
  __populated?: PSchema;
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
) => Promise<ExtractResponseMUTATE<PSchema, T, Include, Select>[]>) & {
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
