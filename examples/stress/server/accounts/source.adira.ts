import { Accounts } from "../database/models";
import { reads } from "../read-context";

export const accountNative = reads.mongo
  .from(Accounts, {
    scope: (e, c) =>
      e.and(
        e.eq(e.field("tenantId"), c.tenantId),
        e.isNull(e.field("deletedAt")),
      ),
  })
  .derive("id", (e) => e.toString(e.field("_id")));
