import {
  AggregateOperation,
  Backend,
  PickDistinctDefinition,
  SortByDefinition,
} from "@n/adira.core.ts";

import { Document, Model, PipelineStage } from "mongoose";
import { buildPopulatePipeline } from "./db/$lookup";
import { filterDefined } from "./db/$filter";
import { normalizeParams } from "./db/$assert-pipeline-params";
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

const generatePickDistinctQuery = (
  pickDistinct: PickDistinctDefinition<any> | undefined,
): PipelineStage[] => {
  if (pickDistinct) {
    const { by, keep, sortBy } = pickDistinct;

    return [
      { $sort: { [sortBy]: keep === "first" ? 1 : -1 } },
      {
        $group: {
          _id: `$${by}`,
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

/**
 * Transforms the user's Grouping intent into a MongoDB $group pipeline stage.
 * Maps 'by' fields to the group identity and 'aggregates' to calculation operators.
 */
const generateGroupQuery = (
  by: string[] | undefined,
  aggregates: AggregateOperation<any>[] | undefined,
): PipelineStage[] => {
  // If no grouping is requested, return an empty pipeline
  if (!by || by.length === 0) return [];

  const groupStage: Record<string, any> = {
    // 1. Define the Identity (The "group" key)
    // If multiple fields, create a composite object. If one, use the direct field.
    _id:
      by.length > 1
        ? by.reduce(
            (acc, field) => {
              acc[field] = `$${field}`;
              return acc;
            },
            {} as Record<string, string>,
          )
        : `$${by[0]}`,
  };

  // 2. Define the Measures (The Aggregates)
  // Maps { on, fn, as } -> { [as]: { [fn]: "$on" } }
  if (aggregates && aggregates.length > 0) {
    for (const { on, fn, as } of aggregates) {
      // Handle $count specifically if needed, otherwise use standard ops
      groupStage[as] = fn === "$count" ? { $sum: 1 } : { [fn]: `$${on}` };
    }
  }

  return [{ $group: groupStage }];
};

const generateSortQuery = (
  sort: SortByDefinition<unknown> | undefined,
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
        where,
        groupBy,
        include,
        limit,
        offset,
        select,
        aggregates,
        pickDistinct,
        sortBy,
      } = normalizeParams(params);

      const projectStage = generateProjectionQuery(select);
      const lookupStages = generateLookupQuery(model, include);
      const pickDistinctStage = generatePickDistinctQuery(pickDistinct);
      const filterStage = generateFilterQuery(where);
      const sortStage = generateSortQuery(sortBy);

      const itemsPipeline = [
        ...lookupStages,
        ...pickDistinctStage,
        ...filterStage,
        ...sortStage,
        projectStage,
        { $skip: offset },
        { $limit: limit },
      ];

      const hasGrouping = groupBy && groupBy.length > 0;

      if (hasGrouping) {
        const groupByStage = generateGroupQuery(groupBy, aggregates);
        const groupPipeline = [
          ...lookupStages,
          ...filterStage,
          ...groupByStage,
        ];
        const [groupedResult] = await model.aggregate(groupPipeline);
        return {
          items: groupedResult,
        };
      } else {
        const [results] = await model.aggregate(itemsPipeline);
        return {
          items: results,
        };
      }
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
