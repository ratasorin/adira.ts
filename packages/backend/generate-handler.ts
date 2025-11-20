import {
  GroupBy,
  SortSpec,
  ExtractSelect,
  Filter,
  PopulatableKeys,
  PopulatedSchema,
  SelectableFieldsAfterJoin,
  BuildResponseBody,
  ExtractResponse,
  GroupOperationsDefinition,
  SortDirection,
  Leafs,
  RowSelection,
} from "@n/adira.core.ts";

import { Document, Model, PipelineStage } from "mongoose";
import { buildPopulatePipeline } from "./db/$lookup";
import { filterDefined } from "./db/$filter";
import {
  normalizeParams,
  SimpleGroupBySpec,
} from "./db/$assert-pipeline-params";
import mongoose from "mongoose";

export type InferInclude<Handler> = Handler extends { __base?: infer T }
  ? string[] & { __base?: T }
  : never;

export type InferSelect<Handler> = Handler extends {
  __populated?: infer P;
  __base?: infer T;
}
  ? Leafs<P>[] & { __full?: P; __base?: T }
  : never;

export type InferFilter<Handler> = Handler extends {
  __populated?: infer P;
  __base?: infer T;
}
  ? Filter<P> & { __full?: P; __base?: T }
  : never;

export type InferGroupBy<Handler> = Handler extends {
  __populated?: infer P;
  __base?: infer T;
}
  ? {
      fields: Leafs<P>[];
      operations: GroupOperationsDefinition<P>[];
    } & {
      __full?: P;
      __base?: T;
    }
  : never;

export type InferSort<Handler> = Handler extends {
  __populated?: infer P;
}
  ? Record<string, SortDirection> & { __full?: P }
  : never;

export type GetResponseBody<
  Handler,
  Include extends any[],
  Select extends any[],
  Aggregation extends GroupOperationsDefinition<any> = [],
  Extra = {},
> = Handler extends {
  __populated?: infer P;
  __base?: infer T;
}
  ? BuildResponseBody<P, T, Include, Select, Aggregation, true, Extra>
  : never;

export type PatchResponseBody<
  Handler,
  Include extends any[],
  Select extends any[],
  Extra = {},
> = Handler extends {
  __populated?: infer P;
  __base?: infer T;
}
  ? BuildResponseBody<P, T, Include, Select, undefined, false, Extra>
  : never;

export type InferPartition<Handler> = Handler extends {
  __base?: infer T;
}
  ? {
      groupBy: string[];
      orderBy: string[];
      take: "first" | "last";
    } & { __base?: T }
  : never;

export type PostResponseBody<
  Handler,
  Include extends any[],
  Select extends any[],
  Extra = {},
> = Handler extends {
  __populated?: infer P;
  __base?: infer T;
}
  ? BuildResponseBody<P, T, Include, Select, undefined, false, Extra>
  : never;

export type GetObjectAfterJoin<
  Handler,
  Include extends readonly any[],
> = Handler extends { __populated?: infer P; __base?: infer T }
  ? SelectableFieldsAfterJoin<P, T, Include>
  : never;

export type InferHandlerParams<Handler> = {
  include: InferInclude<Handler>;
  select: InferSelect<Handler>;
  limit?: number;
  offset?: number;
  filters?: InferFilter<Handler>;
  groupBy?: InferGroupBy<Handler>;
  sort?: InferSort<Handler>;
  partition?: InferPartition<Handler>;
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
  Aggregations extends any[],
  ObjectAfterJoin,
> = {
  include: Include;
  select: Select;
  limit?: number;
  offset?: number;
  filters?: Filter<ObjectAfterJoin>;
  groupBy?: GroupBy<ObjectAfterJoin, Aggregations>;
  sort?: SortSpec<ObjectAfterJoin>;
  partition?: RowSelection<ObjectAfterJoin>;
};

export type NormalizeArray<A, T> = A extends never[] ? T : A;

export type METHOD = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ExecuteGET<
  T,
  R extends Partial<Record<string, any>>,
  PSchema = PopulatedSchema<T, R>,
> = (<
  Include extends NormalizeArray<PopulatableKeys<T>[], string[]>,
  Select extends ExtractSelect<PSchema, T, Include>,
  Agg extends GroupOperationsDefinition<PSchema>,
  ObjectAfterJoin extends SelectableFieldsAfterJoin<PSchema, T, Include>,
>(
  params: InferExecutorParams<Include, Select, Agg, ObjectAfterJoin>,
) => Promise<ExtractResponse<PSchema, T, Include, Select, Agg, true>>) & {
  __base?: T;
  __populated?: PSchema;
};

export type ExecutePOST<
  T,
  R extends Partial<Record<string, any>>,
  PSchema = PopulatedSchema<T, R>,
> = (<
  UserIdField extends keyof T,
  NewItem extends Omit<T, "_id" | UserIdField>,
  Include extends PopulatableKeys<T>[],
  Select extends ExtractSelect<PSchema, T, Include>,
>(params: {
  fields: NewItem;
  userId: string;
  userField: UserIdField;
  include?: Include;
  select?: Select;
}) => Promise<ExtractResponse<PSchema, T, Include, Select, undefined>>) & {
  __base?: T;
  __populated?: PSchema;
};

export type ExecutePATCH<
  T,
  R extends Partial<Record<string, any>>,
  PSchema = PopulatedSchema<T, R>,
> = (<
  UserIdField extends keyof T,
  NewItem extends Partial<Omit<T, "_id" | UserIdField>>,
  Include extends PopulatableKeys<T>[],
  Select extends ExtractSelect<PSchema, T, Include>,
>(params: {
  fields: NewItem;
  id: string;
  userId: string;
  userField: UserIdField;
  include?: Include;
  select?: Select;
}) => Promise<ExtractResponse<PSchema, T, Include, Select, undefined>>) & {
  __base?: T;
  __populated?: PSchema;
};

export type ExecutorReturnType<
  Method extends METHOD,
  T = {},
  R extends Partial<Record<string, any>> = {},
> = Method extends "GET"
  ? ExecuteGET<T, R>
  : Method extends "POST"
    ? ExecutePOST<T, R>
    : Method extends "PATCH"
      ? ExecutePATCH<T, R>
      : never;

const generateProjectionQuery = (select: string[]): PipelineStage.Project => {
  return select.length
    ? {
        $project: Array.from(select).reduce<Record<string, 1>>((acc, field) => {
          acc[field] = 1;
          return acc;
        }, {}),
      }
    : { $project: { __v: 0 } };
};

const generateLookupQuery = <T>(
  model: Model<T>,
  include: string[],
): PipelineStage[] => {
  return include.reduce(
    (prev, curr) => [...prev, ...buildPopulatePipeline(model, curr)],
    [] as any[],
  ) as PipelineStage[];
};

const generatePartitionQuery = (
  partition:
    | {
        groupBy: string;
        orderBy: string;
        take: "first" | "last";
      }
    | undefined,
): PipelineStage[] => {
  if (partition) {
    const { groupBy, orderBy, take } = partition;

    return [
      { $sort: { [orderBy]: take === "first" ? 1 : -1 } },
      {
        $group: {
          _id: `$${groupBy}`,
          doc: { $first: "$$ROOT" },
        },
      },
      { $replaceRoot: { newRoot: "$doc" } },
    ];
  } else return [];
};

const generateFilterQuery = (
  filters: Record<string, any> | undefined,
): PipelineStage[] => {
  if (filters && Object.keys(filters).length > 0) {
    return [{ $match: filters }];
  } else return [];
};

const generateGroupQuery = (
  groupBy: SimpleGroupBySpec | undefined,
): PipelineStage[] => {
  if (groupBy) {
    let groupStage: Record<string, any> = {
      _id:
        groupBy.fields.length > 1
          ? groupBy.fields.reduce(
              (acc, field) => {
                acc[field] = `$${field}`;
                return acc;
              },
              {} as Record<string, string>,
            )
          : `$${groupBy.fields[0]}`,
    };

    if ("aggregations" in groupBy && groupBy.aggregations) {
      for (const { alias, applyOnField, op } of groupBy.aggregations) {
        groupStage = { ...groupStage, [alias]: { [op]: `$${applyOnField}` } };
      }
    }

    return [{ $group: groupStage }];
  } else return [];
};

const generateSortQuery = (
  sort: Record<string, 1 | -1> | undefined,
): PipelineStage[] => {
  if (sort) {
    const $sort = filterDefined(sort);
    return [{ $sort }];
  } else return [];
};
export const generateExecutor = <
  Method extends METHOD,
  T,
  Replacements extends Partial<Record<string, any>>,
>(
  method: Method,
  model: Model<T & Document>,
): ExecutorReturnType<Method, T, Replacements> => {
  if (method === "GET") {
    const fn: ExecuteGET<T, Replacements> = async (params) => {
      const {
        filters,
        groupBy,
        include,
        limit,
        offset,
        partition,
        select,
        sort,
      } = normalizeParams(params);
      const projectStage = generateProjectionQuery(select);
      const lookupStages = generateLookupQuery(model, include);
      const partitionStage = generatePartitionQuery(partition);
      const filterStage = generateFilterQuery(filters);
      const sortStage = generateSortQuery(sort);

      const documentPipeline = [
        ...lookupStages,
        ...partitionStage,
        ...filterStage,
        ...sortStage,
        projectStage,
        { $skip: offset },
        { $limit: limit },
      ];

      const pipeline: PipelineStage[] = [];

      pipeline.push({
        $facet: {
          documents: documentPipeline,
          grouped: [
            ...lookupStages,
            ...filterStage,
            ...generateGroupQuery(groupBy),
          ],
        },
      } as PipelineStage);

      const results = (await model.aggregate(pipeline))[0] as any;

      return results;
    };
    return fn as any;
  }

  if (method === "POST") {
    const fn: ExecutePOST<T, Replacements> = async (params) => {
      const { include, select } = normalizeParams(params);
      let fields: any = params.fields;
      const { userField, userId } = params;

      const pipeline: PipelineStage[] = [];

      const projectStage = generateProjectionQuery(select);
      const lookupStages = generateLookupQuery(model, include);
      pipeline.push(...lookupStages, projectStage);

      const newRecord = await model.create({ ...fields, [userField]: userId });
      pipeline.unshift({ $match: { _id: newRecord._id } });

      const [record] = await model.aggregate(pipeline);

      return record;
    };
    return fn as ExecutorReturnType<Method, T, Replacements>;
  }

  if (method === "PATCH") {
    const fn: ExecutePATCH<T, Replacements> = async (params) => {
      const { include, select } = normalizeParams(params);
      let fields: any = params.fields;
      const { userField, userId, id } = params;

      const pipeline: PipelineStage[] = [];

      const projectStage = generateProjectionQuery(select);
      const lookupStages = generateLookupQuery(model, include);
      pipeline.push(...lookupStages, projectStage);

      const oldRecord = await model.findById(new mongoose.Types.ObjectId(id));
      if (!oldRecord) throw new Error(`Old: Record with id ${id} not found!`);

      const newRecord = await model.findByIdAndUpdate(
        new mongoose.Types.ObjectId(id),
        { ...fields, [userField]: userId },
        { new: true, runValidators: true },
      );

      if (!newRecord) throw new Error(`New: Record with id ${id} not found!`);
      pipeline.unshift({ $match: { _id: newRecord._id } });

      const [record] = await model.aggregate(pipeline);

      return record;
    };
    return fn as ExecutorReturnType<Method, T, Replacements>;
  }

  throw new Error(`Unsupported method: ${method}`);
};
