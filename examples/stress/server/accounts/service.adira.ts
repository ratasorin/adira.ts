import { Agents, Shipments, Tickets } from "../database/models";
import { reads } from "../read-context";

export const ticketSource = reads.mongo
  .from(Tickets, {
    scope: (e, c) =>
      e.and(
        e.eq(e.field("tenantId"), c.tenantId),
        e.isNull(e.field("deletedAt")),
      ),
  })
  .derive("id", (e) => e.toString(e.field("_id")));

export const shipmentSource = reads.mongo
  .from(Shipments, {
    scope: (e, c) =>
      e.and(
        e.eq(e.field("tenantId"), c.tenantId),
        e.isNull(e.field("deletedAt")),
      ),
  })
  .derive("id", (e) => e.toString(e.field("_id")));

export const agentSource = reads.mongo
  .from(Agents, {
    scope: (e, c) =>
      e.and(
        e.eq(e.field("tenantId"), c.tenantId),
        e.isNull(e.field("deletedAt")),
      ),
  })
  .derive("id", (e) => e.toString(e.field("_id")));
