import { type PlanRow } from "@n/adira.backend.ts";
import { schema } from "@n/adira.core.ts";
import { Lines } from "../database/models";
import { reads } from "../read-context";
import { shortageStages } from "./shortages.adira";

export const itemNative = reads.mongo
  .from(Lines, {
    scope: (e, c) =>
      e.and(
        e.eq(e.field("tenantId"), c.tenantId),
        e.isNull(e.field("deletedAt")),
      ),
  })
  .derive("id", (e) => e.toString(e.field("_id")))
  .derive("marginCents", (e) =>
    e.add(
      e.field("grossCents"),
      e.multiply(e.field("costCents"), e.literal(-1)),
    ),
  )
  .native({
    provides: ["shortageUnits"],
    requires: ["productId", "tenantId", "quantity"],
    stages: shortageStages,
    output: schema.object({ shortageUnits: schema.number() }),
  });

export type FulfillmentLineIntermediate = PlanRow<typeof itemNative>;
