import { Products } from "../database/models";
import { reads } from "../read-context";

export const productNative = reads.mongo
  .from(Products, {
    scope: (e, c) =>
      e.and(
        e.eq(e.field("tenantId"), c.tenantId),
        e.isNull(e.field("deletedAt")),
      ),
  })
  .derive("id", (e) => e.toString(e.field("_id")));
