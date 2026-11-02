import { ReadValidationError } from "@n/adira.core.ts";
import express from "express";
import mongoose from "mongoose";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { executeReference } from "../readers.reference";
import { workloads } from "../workloads";
import { registerDiagnostics } from "./diagnostics";
import { createTransport } from "./transport";
export type Mode = "adira" | "reference" | "both";
export async function createApp(mode: Mode = "both") {
  const metadata = await mongoose.connection
    .db!.collection("stress_metadata")
    .findOne({ _id: "dataset" as never });
  if (!metadata)
    throw new Error("No stress dataset. Run the seed command first");
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));
  // A reference-only process does not construct or load the Adira implementation.
  const adira =
    mode === "reference" ? undefined : await import("../readers.adira");
  const tenants = await mongoose.connection
    .db!.collection("stress_tenants")
    .find({})
    .sort({ _id: 1 })
    .toArray();
  const { respond, query } = createTransport(tenants.length);
  app.get("/api/catalog", (_req, res) =>
    res.json({
      metadata,
      tenants: tenants.map((t, i) => ({ index: i, name: t.name })),
      mode,
    }),
  );
  if (adira) {
    app.get(
      "/api/adira-batched/orders",
      respond((req, c) => adira.executeBatchedOrders(query(req), c)),
    );
    app.get(
      "/api/adira-batched/plan/orders",
      respond(async (req, c) => adira.inspectBatchedOrders(query(req), c)),
    );
    app.get(
      "/api/adira/accounts",
      respond((req, c) => adira.executeAdira("accounts", query(req), c)),
    );
    app.get(
      "/api/adira/orders",
      respond((req, c) => adira.executeAdira("orders", query(req), c)),
    );
    app.get(
      "/api/adira/products",
      respond((req, c) => adira.executeAdira("products", query(req), c)),
    );
    app.get(
      "/api/adira/plan/:entity",
      respond(async (req, c) => {
        if (!["accounts", "orders", "products"].includes(req.params.entity))
          throw new ReadValidationError("Unknown resource");
        return adira.inspect(
          req.params.entity as "accounts" | "orders" | "products",
          query(req),
          c,
        );
      }),
    );
  }
  if (mode !== "adira")
    app.get(
      "/api/reference/:view",
      respond((req, c) => {
        const workload = workloads.find((w) => w.id === req.params.view);
        if (!workload) throw new ReadValidationError("Unknown reference view");
        return executeReference(workload.id, c);
      }),
    );
  registerDiagnostics(app, adira, respond);
  app.use("/api", (_req, res) =>
    res
      .status(404)
      .json({ error: "NotFound", message: "Unknown API endpoint" }),
  );
  app.use(express.static(resolve(__dirname, "../../public")));
  app.get("*", (_req, res) =>
    res.sendFile(resolve(__dirname, "../../public/index.html")),
  );
  return app;
}
export async function listen(mode: Mode = "both", port = 5400) {
  const app = await createApp(mode);
  const server = app.listen(port, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  return {
    server,
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
  };
}
