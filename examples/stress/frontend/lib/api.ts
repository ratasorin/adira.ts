import {
  readRecord,
  schema,
  type ExactReadQuery,
  type ReadData,
  type ReadQuery,
  type ResourceLike,
} from "@n/adira.core.ts";
import {
  AccountResource,
  OrderResource,
  ProductResource,
} from "../../contracts/resources";
export interface Telemetry {
  backend: string;
  serverMs: number;
  mongoMs: number;
  commands: number;
  commandNames: Record<string, number>;
  callbacks: Record<string, number>;
  dataBytes: number;
  memory: { rss: number; heapUsed: number };
}
export type Result<T> = T & {
  telemetry: Telemetry;
};
type ParsedRow = Record<string, unknown>;
const finite = schema.number();
const numberRecord = schema.custom((value: unknown) =>
  Object.fromEntries(
    Object.entries(readRecord(value, "telemetry counters")).map(
      ([key, count]) => [key, finite.parse(count)],
    ),
  ),
);
const telemetrySchema = schema.object({
  backend: schema.string(),
  serverMs: finite,
  mongoMs: finite,
  commands: finite,
  commandNames: numberRecord,
  callbacks: numberRecord,
  dataBytes: finite,
  memory: schema.object({ rss: finite, heapUsed: finite }),
});

function selectedRows(
  resource: ResourceLike,
  query: { select: object },
  value: unknown,
): ParsedRow[] {
  if (!Array.isArray(value)) throw new Error("Expected response rows.");
  return value.map((value: unknown) => {
    const row = readRecord(value, "response row");
    return Object.fromEntries(
      Object.entries(query.select)
        .filter(([, selection]: [string, unknown]) => selection !== undefined)
        .map(([name, selection]: [string, unknown]) => {
          const field = resource.fields[name];
          if (!field) throw new Error(`Unknown response field '${name}'.`);
          if (field.kind === "scalar")
            return [name, field.value.parse(row[name])];
          if (row[name] === null && field.allowsNull) return [name, null];
          const child = readRecord(selection, `select.${name}`);
          const childQuery = {
            select: readRecord(child.select, `select.${name}.select`),
          };
          const children = selectedRows(
            field.resource,
            childQuery,
            field.many ? row[name] : [row[name]],
          );
          return [name, field.many ? children : children[0]];
        }),
    );
  });
}

export async function fetchRead<
  R extends ResourceLike,
  const Q extends ReadQuery<R>,
>(
  resource: R,
  entity: string,
  query: Q,
  tenant: number,
  backend: "adira" | "adira-batched" = "adira",
  signal?: AbortSignal,
): Promise<Result<ReadData<R, Q>>> {
  const response = await fetch(
    `/api/${backend}/${entity}?query=${encodeURIComponent(JSON.stringify(query))}`,
    { headers: { "x-tenant-index": String(tenant) }, signal },
  );
  const raw: unknown = await response.json();
  const body = readRecord(raw, "response");
  if (!response.ok)
    throw new Error(`${String(body.error)}: ${String(body.message)}`);
  const rows = selectedRows(resource, query, body.rows);
  // Selected values have been checked against the same resource that types Q.
  return {
    ...({ rows } as ReadData<R, Q>),
    telemetry: telemetrySchema.parse(body.telemetry),
  };
}
export const getAccounts = <const Q extends ReadQuery<typeof AccountResource>>(
  query: Q & ExactReadQuery<typeof AccountResource, Q>,
  tenant = 0,
) =>
  fetchRead<typeof AccountResource, Q>(
    AccountResource,
    "accounts",
    query,
    tenant,
  );
export const getOrders = <const Q extends ReadQuery<typeof OrderResource>>(
  query: Q & ExactReadQuery<typeof OrderResource, Q>,
  tenant = 0,
) => fetchRead<typeof OrderResource, Q>(OrderResource, "orders", query, tenant);
export const getProducts = <const Q extends ReadQuery<typeof ProductResource>>(
  query: Q & ExactReadQuery<typeof ProductResource, Q>,
  tenant = 0,
) =>
  fetchRead<typeof ProductResource, Q>(
    ProductResource,
    "products",
    query,
    tenant,
  );
export const getOrdersBatched = <
  const Q extends ReadQuery<typeof OrderResource>,
>(
  query: Q & ExactReadQuery<typeof OrderResource, Q>,
  tenant = 0,
) =>
  fetchRead<typeof OrderResource, Q>(
    OrderResource,
    "orders",
    query,
    tenant,
    "adira-batched",
  );
