import { Orders } from "../database/models";
import { reads } from "../read-context";

export const orderNative = reads.mongo
  .from(Orders, {
    scope: (e, c) =>
      e.and(
        e.eq(e.field("tenantId"), c.tenantId),
        e.isNull(e.field("deletedAt")),
      ),
  })
  .derive("id", (e) => e.toString(e.field("_id")))
  .derive("netCents", (e) =>
    e.add(
      e.field("totalCents"),
      e.multiply(e.field("refundedCents"), e.literal(-1)),
    ),
  );
