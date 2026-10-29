import { type RequestContext } from "../../harness/telemetry";
import { type Id } from "./models";

export const key = (id: unknown) => String(id);

export const base = (c: RequestContext) => ({
  tenantId: c.tenantId,
  deletedAt: null,
});

export const byId = (
  a: {
    id: string;
  },
  b: {
    id: string;
  },
) => a.id.localeCompare(b.id);

export const selected = (
  row: Record<string, unknown>,
  fields: readonly string[],
) => Object.fromEntries(fields.map((field) => [field, row[field]]));

export const unique = (ids: Id[]) => [
  ...new Map(ids.map((id) => [key(id), id])).values(),
];

export const byObjectId = (
  a: {
    _id: Id;
  },
  b: {
    _id: Id;
  },
) => key(a._id).localeCompare(key(b._id));
