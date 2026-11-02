import { test } from "node:test";
import assert from "node:assert/strict";
import express, { type Request, type Response } from "express";
import mongoose from "mongoose";
import type { AddressInfo } from "node:net";
import type { Backend } from "@n/adira.core.ts";
import { createApiClient } from "../../client/index";
import {
  buildGetHandler,
  buildPostHandler,
  buildPatchHandler,
  buildDeleteHandler,
} from "../generate-handler";
import { getCategories } from "./fixtures";

type Item = { name: string; count: number };
const Items = mongoose.model<Item & mongoose.Document>(
  "FlatResponseItem",
  new mongoose.Schema<Item & mongoose.Document>({
    name: String,
    count: Number,
  }),
);
const get = buildGetHandler<Item>(Items);
const post = buildPostHandler<Item>(Items);
const patch = buildPatchHandler<Item>(Items);
const remove = buildDeleteHandler<Item>(Items);
type Failure = { error: true; message: string };
type ManagedSuccess = Backend.InferHandlerResponse<
  typeof getCategories,
  { total: number }
> & { requestId: string };
type API = {
  "/api/items": {
    GET: {
      RequestQuery: Backend.InferHandlerParams<typeof get>;
      ResponseBody: Backend.InferHandlerResponse<typeof get> | Failure;
    };
    POST: {
      RequestBody: Backend.InferRequestBody<typeof post>;
      RequestQuery: Backend.InferHandlerParams<typeof post>;
      ResponseBody: Backend.InferHandlerResponse<typeof post> | Failure;
    };
  };
  "/api/items/:id": {
    PATCH: {
      RequestPath: { id: string };
      RequestBody: Backend.InferRequestBody<typeof patch>;
      RequestQuery: Backend.InferHandlerParams<typeof patch>;
      ResponseBody: Backend.InferHandlerResponse<typeof patch> | Failure;
    };
    DELETE: {
      RequestPath: { id: string };
      RequestBody: Backend.InferRequestBody<typeof remove>;
      RequestQuery: Backend.InferHandlerParams<typeof remove>;
      ResponseBody: Backend.InferHandlerResponse<typeof remove> | Failure;
    };
  };
  "/api/managed": {
    GET: {
      RequestQuery: Backend.InferHandlerParams<typeof getCategories>;
      ResponseBody: ManagedSuccess | Failure;
    };
  };
  "/api/plain": {
    GET: {
      RequestQuery: { token: string };
      ResponseBody: { rows: { token: string }[]; status: "ready" };
    };
  };
};
async function respond<Data>(
  res: Response<Data | Failure>,
  work: () => Promise<Data>,
) {
  try {
    res.send(await work());
  } catch (error) {
    res.status(500).send({ error: true, message: String(error) });
  }
}

test("flat legacy CRUD, managed metadata, and ordinary row responses work through the client", async () => {
  const app = express();
  app.use(express.json());
  app.get(
    "/api/items",
    (
      req: Request<
        never,
        unknown,
        unknown,
        Backend.InferHandlerParams<typeof get>
      >,
      res: Response<Backend.InferHandlerResponse<typeof get> | Failure>,
    ) => respond(res, () => get(req.query)),
  );
  app.post(
    "/api/items",
    (
      req: Request<
        never,
        unknown,
        Backend.InferRequestBody<typeof post>,
        Backend.InferHandlerParams<typeof post>
      >,
      res: Response<Backend.InferHandlerResponse<typeof post> | Failure>,
    ) => respond(res, () => post(req.query, req.body)),
  );
  app.patch(
    "/api/items/:id",
    (
      req: Request<
        { id: string },
        unknown,
        Backend.InferRequestBody<typeof patch>,
        Backend.InferHandlerParams<typeof patch>
      >,
      res: Response<Backend.InferHandlerResponse<typeof patch> | Failure>,
    ) =>
      respond(res, () =>
        patch(req.params.id, req.query, req.body, { createNewRecord: true }),
      ),
  );
  app.delete(
    "/api/items/:id",
    (
      req: Request<
        { id: string },
        unknown,
        Backend.InferRequestBody<typeof remove>,
        Backend.InferHandlerParams<typeof remove>
      >,
      res: Response<Backend.InferHandlerResponse<typeof remove> | Failure>,
    ) => respond(res, () => remove(req.params.id, req.query, {})),
  );
  app.get(
    "/api/managed",
    (
      req: Request<
        never,
        unknown,
        unknown,
        Backend.InferHandlerParams<typeof getCategories>
      >,
      res: Response<ManagedSuccess | Failure>,
    ) =>
      respond(res, async () => {
        const result = await getCategories(req.query);
        return {
          ...result,
          related: { total: result.rows.length },
          requestId: "request-1",
        };
      }),
  );
  app.get("/api/plain", (_req, res) =>
    res.json({ rows: [{ token: "A" }], status: "ready" }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((done) => server.once("listening", done));
  try {
    const api = createApiClient<API>(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    );
    const created = await api(
      "/items",
      "POST",
    )({
      data: { name: "A", count: 1 },
      query: { rows: (r) => r({ select: ["name", "count"] }) },
    }).run();
    if ("error" in created) assert.fail(created.message);
    assert.equal(created.name, "A");
    assert.equal(created.count, 1);
    const document = await Items.findOne({ name: "A" });
    assert.ok(document);
    const id = String(document._id);
    const read = await api(
      "/items",
      "GET",
    )({ query: { rows: (r) => r({ select: ["name"] }) } }).run();
    if ("error" in read) assert.fail(read.message);
    assert.equal(read.rows[0].name, "A");
    const updated = await api(
      "/items/:id",
      "PATCH",
    )({
      path: { id },
      data: { count: 2 },
      query: { rows: (r) => r({ select: ["count"] }) },
    }).run();
    if ("error" in updated) assert.fail(updated.message);
    assert.equal(updated.count, 2);
    const deleted = await api(
      "/items/:id",
      "DELETE",
    )({
      path: { id },
      data: {},
      query: { rows: (r) => r({ select: ["name"] }) },
    }).run();
    if ("error" in deleted) assert.fail(deleted.message);
    assert.equal(deleted.length, 1);
    assert.equal(deleted[0].name, "A");
    assert.equal(await Items.countDocuments(), 0);
    const managed = await api(
      "/managed",
      "GET",
    )({ query: { select: { name: true }, page: { limit: 1 } } }).run();
    if ("error" in managed) assert.fail(managed.message);
    assert.equal(managed.rows.length, 1);
    assert.equal(managed.related?.total, 1);
    assert.equal(managed.requestId, "request-1");
    assert.deepEqual(Object.keys(managed).sort(), [
      "related",
      "requestId",
      "rows",
    ]);
    const ordinary = await api(
      "/plain",
      "GET",
    )({ query: { token: "A" } }).run();
    assert.deepEqual(ordinary, { rows: [{ token: "A" }], status: "ready" });
  } finally {
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
    await Items.deleteMany({});
  }
});
