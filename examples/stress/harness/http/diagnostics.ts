import { ReadValidationError } from "@n/adira.core.ts";
import type express from "express";
import { referenceVolatility } from "../../server/accounts/history.reference";
import { SINCE } from "../../server/clock";
import {
  Accounts,
  models,
  Orders,
  Products,
} from "../../server/database/models";
import { executeReference } from "../readers.reference";
import { oid } from "../seed";
import { workloads } from "../workloads";
import type { createTransport } from "./transport";

export function registerDiagnostics(
  app: express.Express,
  adira: typeof import("../readers.adira") | undefined,
  respond: ReturnType<typeof createTransport>["respond"],
) {
  if (adira)
    app.get(
      "/api/diagnostics/budget",
      respond(async (req, c) => {
        const tenant = Number(req.header("x-tenant-index") ?? 0),
          id = oid(3, tenant, 0);
        const reference = await referenceVolatility(id, c);
        const childQuery = {
          select: {
            id: true,
            orders: {
              select: { id: true, priority: true },
              where: {
                placedAt: { $gte: SINCE },
              },
              orderBy: { priority: "desc", id: "asc" },
              page: { limit: 2 },
            },
          },
          where: { id: { $eq: String(id) } },
          page: { limit: 1 },
        } as const;
        let childPage: unknown;
        try {
          childPage = await adira.executeAdira("accounts", childQuery, c);
        } catch (error) {
          childPage = {
            error: error instanceof Error ? error.name : "Error",
            message: String(error),
          };
        }
        const computedChildPage = {
          query: childQuery,
          reference: reference.priorityTop2,
          adira: childPage,
        };
        try {
          return {
            reference,
            adira: await adira.executeAdira(
              "accounts",
              {
                select: { id: true, name: true, orderVolatility: true },
                where: { id: { $eq: String(id) } },
              },
              c,
            ),
            candidateLimit: 400,
            computedChildPage,
          };
        } catch (error) {
          return {
            reference,
            adira: {
              error: error instanceof Error ? error.name : "Error",
              message: String(error),
            },
            candidateLimit: 400,
            computedChildPage,
          };
        }
      }),
    );
  app.get(
    "/api/diagnostics/indexes",
    respond(async () =>
      Object.fromEntries(
        await Promise.all(
          models.map(async (model) => [
            model.collection.name,
            await model.collection.indexes(),
          ]),
        ),
      ),
    ),
  );
  if (adira)
    app.get(
      "/api/diagnostics/commands/:view",
      respond(async (req, c) => {
        const workload = workloads.find((w) => w.id === req.params.view);
        if (!workload) throw new ReadValidationError("Unknown view");
        const backend = req.query.backend ?? "adira";
        if (
          backend !== "adira" &&
          backend !== "reference" &&
          backend !== "adiraBatched"
        )
          throw new ReadValidationError("Unknown backend");
        if (backend === "adiraBatched" && workload.entity !== "orders")
          throw new ReadValidationError(
            "The batched alternative is an order resource",
          );
        c.trace.details = [];
        const result =
          backend === "adiraBatched"
            ? await adira.executeBatchedOrders(workload.query, c)
            : backend === "adira"
              ? await adira.executeAdira(workload.entity, workload.query, c)
              : await executeReference(workload.id, c);
        return {
          note: "Untimed command trace; returned counts include intermediate rows and repeated rows. Durations may overlap.",
          backend,
          rows: result.rows.length,
          commands: c.trace.details,
          callbacks: c.trace.callbacks,
        };
      }),
    );
  if (adira)
    app.get(
      "/api/diagnostics/explain/:view",
      respond(async (req, c) => {
        const workload = workloads.find((w) => w.id === req.params.view);
        if (!workload) throw new ReadValidationError("Unknown view");
        const plan = adira.inspect(workload.entity, workload.query, c);
        const collection =
          workload.entity === "accounts"
            ? Accounts.collection
            : workload.entity === "orders"
              ? Orders.collection
              : Products.collection;
        const explanation = await collection
          .aggregate(plan.pipeline as object[])
          .explain("executionStats");
        return {
          note: "Only the Adira root native pipeline; deferred loads, JavaScript and later database calls are not included",
          plan,
          explanation,
        };
      }),
    );
}
