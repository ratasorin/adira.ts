import type { Backend, Frontend, ResourceOfResponse } from "@n/adira.core.ts";
import type { getCategories } from "./fixtures";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;
type OrdinaryRows = Expect<
  Equal<ResourceOfResponse<{ rows: { token: string }[] }>, never>
>;
type Item = { name: string; count: number };
type Get = Backend.ExecuteGET<Item>;
type Post = Backend.ExecutePOST<Item>;
type Patch = Backend.ExecutePATCH<Item>;
type Delete = Backend.ExecuteDELETE<Item>;
type Failure = { error: true; message: string };
type API = {
  "/api/resource": {
    GET: {
      RequestQuery: Backend.InferHandlerParams<typeof getCategories>;
      ResponseBody:
        | (Backend.InferHandlerResponse<
            typeof getCategories,
            { total: number }
          > & { requestId: string })
        | Failure;
    };
  };
  "/api/plain": {
    GET: {
      RequestQuery: { token: string };
      ResponseBody: { rows: { token: string }[]; status: "ready" };
    };
  };
  "/api/items": {
    GET: {
      RequestQuery: Backend.InferHandlerParams<Get>;
      ResponseBody:
        | Backend.InferHandlerResponse<Get, { total: number }>
        | Failure;
    };
    POST: {
      RequestQuery: Backend.InferHandlerParams<Post>;
      RequestBody: Backend.InferRequestBody<Post>;
      ResponseBody:
        | Backend.InferHandlerResponse<Post, { auditId: string }>
        | Failure;
    };
  };
  "/api/items/:id": {
    PATCH: {
      RequestPath: { id: string };
      RequestQuery: Backend.InferHandlerParams<Patch>;
      RequestBody: Backend.InferRequestBody<Patch>;
      ResponseBody: Backend.InferHandlerResponse<Patch> | Failure;
    };
    DELETE: {
      RequestPath: { id: string };
      RequestQuery: Backend.InferHandlerParams<Delete>;
      RequestBody: Backend.InferRequestBody<Delete>;
      ResponseBody:
        | Backend.InferHandlerResponse<Delete, { auditId: string }>
        | Failure;
    };
  };
};
declare const createClient: Frontend.CreateAxiosApiClient;
const api = createClient<API>("http://localhost");
export async function resourceResponse() {
  const output = await api(
    "/resource",
    "GET",
  )({ query: { select: { name: true } } }).run();
  if ("error" in output) {
    const message: string = output.message;
    return message;
  }
  const name: string = output.rows[0].name;
  const requestId: string = output.requestId;
  const total: number | undefined = output.related?.total;
  // @ts-expect-error Resource results expose only selected row fields.
  output.rows[0].slug;
  // @ts-expect-error Transport metadata retains its declared type.
  const wrong: number = output.requestId;
  // @ts-expect-error Public responses have no result wrapper.
  output.executor;
  // @ts-expect-error Resource inference markers do not become client data.
  output.__resource;
  return { name, requestId, total, wrong };
}
export async function legacyResponses() {
  const read = await api(
    "/items",
    "GET",
  )({
    query: {
      rows: (r) => r({ select: ["name"] }),
      groups: (g) => ({
        names: g({
          by: ["name"],
          aggregates: [{ on: "count", as: "total", fn: "$sum" }],
        }),
      }),
    },
  }).run();
  if ("error" in read) return read.message;
  const name: string = read.rows[0].name;
  const groupTotal: number | undefined = read.groups?.names[0].total;
  const total: number | undefined = read.related?.total;
  // @ts-expect-error Legacy read selections still exclude other fields.
  read.rows[0].count;

  const created = await api(
    "/items",
    "POST",
  )({
    data: { name: "A", count: 1 },
    query: { rows: (r) => r({ select: ["name"] }) },
  }).run();
  if ("error" in created) return created.message;
  const createdName: string = created.name;
  const auditId: string | undefined = created.related?.auditId;
  // @ts-expect-error Mutation selections exclude unselected fields.
  created.count;

  const updated = await api(
    "/items/:id",
    "PATCH",
  )({
    path: { id: "id" },
    data: { count: 2 },
    query: { rows: (r) => r({ select: ["count"] }) },
  }).run();
  if ("error" in updated) return updated.message;
  const count: number = updated.count;

  const deleted = await api(
    "/items/:id",
    "DELETE",
  )({
    path: { id: "id" },
    data: {},
    query: { rows: (r) => r({ select: ["name"] }) },
  }).run();
  if ("error" in deleted) return deleted.message;
  const deletedName: string = deleted[0].name;
  const deletedAuditId: string | undefined = deleted[0].related?.auditId;
  return {
    name,
    groupTotal,
    total,
    createdName,
    auditId,
    count,
    deletedName,
    deletedAuditId,
  };
}
export async function ordinaryResponse() {
  const output = await api("/plain", "GET")({ query: { token: "A" } }).run();
  const token: string = output.rows[0].token;
  const status: "ready" = output.status;
  // @ts-expect-error Ordinary response rows retain their own contract.
  output.rows[0].name;
  return { token, status };
}
