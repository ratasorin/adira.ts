import { GroupByDefinition } from "..";
import { SortByDefinition } from "..";
import { RowsPrunerDefiniton } from "..";
import { GroupOperationsDefinition } from "..";
import { FilterDefinition } from "..";
import { Leafs } from "..";

export type InferInclude<Base> = string[] & { __base?: Base };

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
        handler?: HandlerExtraWorkReturn;
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
