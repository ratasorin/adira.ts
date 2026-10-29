import type { BatchParent } from "@n/adira.backend.ts";
import type { PipelineStage } from "mongoose";
import { type RequestContext } from "../../harness/telemetry";
import { type Id } from "./models";

export type Input<Row extends object = { _id: Id }> = {
  readonly parents: readonly BatchParent<Row>[];
  readonly context: RequestContext;
};

export const parentKey = "__demo_parent_key";

export const idsFor = (parents: Input["parents"]) => [
  ...new Map(parents.map(({ row }) => [String(row._id), row._id])).values(),
];

export function activeTenant(context: RequestContext) {
  return {
    tenantId: context.tenantId,
    $expr: {
      $and: [
        { $eq: ["$tenantId", { $literal: context.tenantId }] },
        { $eq: [{ $ifNull: ["$deletedAt", null] }, null] },
      ],
    },
  };
}

export function parentGroups(
  field: "accountId" | "productId",
  ids: readonly Id[],
): PipelineStage[] {
  const foreign = `$${field}`;
  return [
    {
      $set: {
        [parentKey]: {
          $cond: [
            { $isArray: foreign },
            { $setIntersection: [foreign, { $literal: ids }] },
            [foreign],
          ],
        },
      },
    },
    { $unwind: `$${parentKey}` },
  ];
}
