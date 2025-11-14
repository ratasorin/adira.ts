import {
  AggLike,
  GroupSpec,
  SortSpec,
  PartitionSpec,
  ExtractSelect,
  Filter,
  PopulatableKeys,
  PopulatedSchema,
  SelectableFieldsAfterJoin,
  BuildResponseBody,
  ExtractResponse,
} from "@n/adira.core.ts";

import { Document, Model, PipelineStage } from "mongoose";
import { buildPopulatePipeline } from "./db/$lookup";
import { filterDefined } from "./db/$filter";
import {
  normalizeParams,
  SimpleGroupBySpec,
} from "./db/$assert-pipeline-params";
import mongoose from "mongoose";

export type GetInclude<Handler> = Handler extends { __base?: infer T }
  ? PopulatableKeys<T>[] & { __base?: T }
  : never;

export type GetSelect<Handler, Include extends any[]> = Handler extends {
  __populated?: infer P;
  __base?: infer T;
}
  ? ExtractSelect<P, T, Include> & { __full?: P; __base?: T }
  : never;

export type GetAggregation<Handler> = Handler extends { __populated?: infer P }
  ? AggLike<P>
  : never;

export type GetResponseBody<
  Handler,
  Include extends any[],
  Select extends any[],
  Aggregation extends AggLike<any> = [],
  Extra = {}
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
  Extra = {}
> = Handler extends {
  __populated?: infer P;
  __base?: infer T;
}
  ? BuildResponseBody<P, T, Include, Select, undefined, false, Extra>
  : never;

export type PostResponseBody<
  Handler,
  Include extends any[],
  Select extends any[],
  Extra = {}
> = Handler extends {
  __populated?: infer P;
  __base?: infer T;
}
  ? BuildResponseBody<P, T, Include, Select, undefined, false, Extra>
  : never;

export type GetObjectAfterJoin<
  Handler,
  Include extends readonly any[]
> = Handler extends { __populated?: infer P; __base?: infer T }
  ? SelectableFieldsAfterJoin<P, T, Include>
  : never;

export type GetParams<
  Include extends any[],
  Select extends any[],
  Aggregations extends any[] = [],
  ObjectAfterJoin = any
> = {
  include: Include;
  select: Select;
  limit?: number;
  offset?: number;
  filters?: Filter<ObjectAfterJoin>;
  groupBy?: GroupSpec<ObjectAfterJoin, Aggregations>;
  sort?: SortSpec<ObjectAfterJoin>;
  partition?: PartitionSpec<ObjectAfterJoin>;
};

export type METHOD = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type GetHandler<
  T = {},
  R extends Partial<Record<string, any>> = {},
  PSchema = PopulatedSchema<T, R>
> = (<
  Include extends PopulatableKeys<T>[],
  Select extends ExtractSelect<PSchema, T, Include>,
  Agg extends AggLike<PSchema>,
  ObjectAfterJoin extends SelectableFieldsAfterJoin<PSchema, T, Include>
>(
  params: GetParams<Include, Select, Agg, ObjectAfterJoin>
) => Promise<ExtractResponse<PSchema, T, Include, Select, Agg, true>>) & {
  __base?: T;
  __populated?: PSchema;
};

export type PostHandler<
  T,
  R extends Partial<Record<string, any>>,
  PSchema = PopulatedSchema<T, R>
> = (<
  UserIdField extends keyof T,
  NewItem extends Omit<T, "_id" | UserIdField>,
  Include extends PopulatableKeys<T>[],
  Select extends ExtractSelect<PSchema, T, Include>
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

export type PatchHandler<
  T,
  R extends Partial<Record<string, any>>,
  PSchema = PopulatedSchema<T, R>
> = (<
  UserIdField extends keyof T,
  NewItem extends Partial<Omit<T, "_id" | UserIdField>>,
  Include extends PopulatableKeys<T>[],
  Select extends ExtractSelect<PSchema, T, Include>
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

export type RouteHandlerReturn<
  Method extends METHOD,
  T = {},
  R extends Partial<Record<string, any>> = {}
> = Method extends "GET"
  ? GetHandler<T, R>
  : Method extends "POST"
  ? PostHandler<T, R>
  : Method extends "PATCH"
  ? PatchHandler<T, R>
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
  include: string[]
): PipelineStage[] => {
  return include.reduce(
    (prev, curr) => [...prev, ...buildPopulatePipeline(model, curr)],
    [] as any[]
  ) as PipelineStage[];
};

const generatePartitionQuery = (
  partition:
    | {
        groupBy: string;
        orderBy: string;
        take: "first" | "last";
      }
    | undefined
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
  filters: Record<string, any> | undefined
): PipelineStage[] => {
  if (filters && Object.keys(filters).length > 0) {
    return [{ $match: filters }];
  } else return [];
};

const generateGroupQuery = (
  groupBy: SimpleGroupBySpec | undefined
): PipelineStage[] => {
  if (groupBy) {
    let groupStage: Record<string, any> = {
      _id:
        groupBy.fields.length > 1
          ? groupBy.fields.reduce((acc, field) => {
              acc[field] = `$${field}`;
              return acc;
            }, {} as Record<string, string>)
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
  sort: Record<string, 1 | -1> | undefined
): PipelineStage[] => {
  if (sort) {
    const $sort = filterDefined(sort);
    return [{ $sort }];
  } else return [];
};
export const generateRouteHandler = <
  Method extends METHOD,
  T = {},
  R extends Partial<Record<string, any>> = {}
>(
  method: Method,
  model: Model<T & Document>
): RouteHandlerReturn<Method, T, R> => {
  if (method === "GET") {
    const fn: GetHandler<T, R> = async (params) => {
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
    const fn: PostHandler<T, R> = async (params) => {
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
    return fn as RouteHandlerReturn<Method, T, R>;
  }

  if (method === "PATCH") {
    const fn: PatchHandler<T, R> = async (params) => {
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
        { new: true, runValidators: true }
      );

      if (!newRecord) throw new Error(`New: Record with id ${id} not found!`);
      pipeline.unshift({ $match: { _id: newRecord._id } });

      const [record] = await model.aggregate(pipeline);

      return record;
    };
    return fn as RouteHandlerReturn<Method, T, R>;
  }

  throw new Error(`Unsupported method: ${method}`);
};
