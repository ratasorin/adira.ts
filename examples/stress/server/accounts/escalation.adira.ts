import type { PipelineStage } from "mongoose";
import { AS_OF, DAY } from "../clock";
import { Tickets } from "../database/models";

export const escalationStages: PipelineStage[] = [
  {
    $lookup: {
      from: Tickets.collection.name,
      localField: "_id",
      foreignField: "accountId",
      let: { tenant: "$tenantId" },
      pipeline: [
        {
          $match: {
            status: { $in: ["open", "pending"] },
            priority: { $gte: 4 },
            openedAt: { $gte: AS_OF - 30 * DAY },
            $expr: {
              $and: [
                { $eq: ["$tenantId", "$$tenant"] },
                { $eq: [{ $ifNull: ["$deletedAt", null] }, null] },
              ],
            },
          },
        },
        { $limit: 1 },
        { $project: { _id: 0, priority: 1 } },
      ],
      as: "recentEscalations",
    },
  },
];
