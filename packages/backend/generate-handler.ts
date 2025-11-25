import { Backend } from "@n/adira.core.ts";

import { Document, Model, PipelineStage } from "mongoose";
import { buildPopulatePipeline } from "./db/$lookup";
import { filterDefined } from "./db/$filter";
import {
  normalizeParams,
  SimpleGroupBySpec,
} from "./db/$assert-pipeline-params";
import mongoose from "mongoose";

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
export const generateExecutor = <Method extends Backend.METHOD, T>(
  method: Method,
  model: Model<T & Document>,
): Backend.ExecutorReturnType<T, Method> => {
  if (method === "GET") {
    const fn: Backend.ExecuteGET<T> = async (params) => {
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
    const fn: Backend.ExecutePOST<T> = async (params, newItem) => {
      const { include, select } = normalizeParams(params);

      const pipeline: PipelineStage[] = [];

      const projectStage = generateProjectionQuery(select);
      const lookupStages = generateLookupQuery(model, include);
      pipeline.push(...lookupStages, projectStage);

      const newRecord = await model.create(newItem);
      pipeline.unshift({ $match: { _id: newRecord._id } });

      const [record] = await model.aggregate(pipeline);

      return record;
    };
    return fn as Backend.ExecutorReturnType<T, Method>;
  }

  if (method === "DELETE") {
    const fn: Backend.ExecuteDELETE<T> = async (id, params, config) => {
      const { include, select } = normalizeParams(params);

      const pipeline: PipelineStage[] = [];

      const projectStage = generateProjectionQuery(select);
      const lookupStages = generateLookupQuery(model, include);
      pipeline.push(...lookupStages, projectStage);

      // First, get the record to return it
      pipeline.unshift({ $match: { _id: new mongoose.Types.ObjectId(id) } });
      const [record] = await model.aggregate(pipeline);

      if (!record) throw new Error(`Record with id ${id} not found!`);

      // Perform the deletion
      if (config.softDelete) {
        await config.softDelete();
      } else {
        await model.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
      }

      return [record];
    };
    return fn as Backend.ExecutorReturnType<T, Method>;
  }

  if (method === "PATCH") {
    const fn: Backend.ExecutePATCH<T> = async (id, params, fields, config) => {
      const { include, select } = normalizeParams(params);

      const pipeline: PipelineStage[] = [];

      const projectStage = generateProjectionQuery(select);
      const lookupStages = generateLookupQuery(model, include);
      pipeline.push(...lookupStages, projectStage);

      const oldRecord = await model.findById(new mongoose.Types.ObjectId(id));
      if (!oldRecord) throw new Error(`Old: Record with id ${id} not found!`);

      const newRecord = await model.findByIdAndUpdate(
        new mongoose.Types.ObjectId(id),
        fields,
        { new: config.createNewRecord, runValidators: true },
      );

      if (!newRecord) throw new Error(`New: Record with id ${id} not found!`);
      pipeline.unshift({ $match: { _id: newRecord._id } });

      const [record] = await model.aggregate(pipeline);

      return record;
    };
    return fn as Backend.ExecutorReturnType<T, Method>;
  }

  throw new Error(`Unsupported method: ${method}`);
};
