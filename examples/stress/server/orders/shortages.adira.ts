import type { PipelineStage } from "mongoose";
import { Inventories } from "../database/models";

export const shortageStages: PipelineStage[] = [
  {
    $lookup: {
      from: Inventories.collection.name,
      localField: "productId",
      foreignField: "productId",
      let: { tenant: "$tenantId" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$tenantId", "$$tenant"] },
                { $eq: [{ $ifNull: ["$deletedAt", null] }, null] },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            available: { $sum: { $subtract: ["$onHand", "$reserved"] } },
          },
        },
      ],
      as: "_stockForLine",
    },
  },
  {
    $set: {
      shortageUnits: {
        $max: [
          0,
          {
            $subtract: [
              "$quantity",
              {
                $max: [
                  0,
                  { $ifNull: [{ $first: "$_stockForLine.available" }, 0] },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  { $unset: "_stockForLine" },
];
