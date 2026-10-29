import { ReadValidationError, readRecord } from "@n/adira.core.ts";
import type express from "express";
import { oid } from "../seed";
import { newTrace, traces, type RequestContext } from "../telemetry";

export function createTransport(tenantCount: number) {
  const context = (req: express.Request): RequestContext => {
    const tenant = Number(req.header("x-tenant-index") ?? 0);
    if (!Number.isInteger(tenant) || tenant < 0 || tenant >= tenantCount)
      throw new ReadValidationError("Invalid tenant index");
    return { tenantId: oid(1, tenant, 0), trace: newTrace() };
  };
  const respond =
    (work: (req: express.Request, c: RequestContext) => Promise<unknown>) =>
    async (req: express.Request, res: express.Response) => {
      let c: RequestContext | undefined;
      try {
        c = context(req);
        const data = await traces.run(c.trace, () => work(req, c!));
        res.json({
          ...readRecord(data, "response data"),
          telemetry: {
            backend: req.path.includes("/reference/")
              ? "reference"
              : req.path.includes("/adira-batched/")
                ? "adiraBatched"
                : "adira",
            serverMs: performance.now() - c.trace.started,
            mongoMs: c.trace.mongoMs,
            commands: c.trace.commands,
            commandNames: c.trace.commandNames,
            callbacks: c.trace.callbacks,
            dataBytes: Buffer.byteLength(JSON.stringify(data)),
            memory: process.memoryUsage(),
          },
        });
      } catch (error) {
        res
          .status(
            error instanceof Error && error.name === "ReadBudgetError"
              ? 422
              : error instanceof ReadValidationError
                ? 400
                : 500,
          )
          .json({
            error: error instanceof Error ? error.name : "Error",
            message: error instanceof Error ? error.message : String(error),
            telemetry: c
              ? {
                  serverMs: performance.now() - c.trace.started,
                  commands: c.trace.commands,
                  callbacks: c.trace.callbacks,
                }
              : undefined,
          });
      }
    };
  const query = (req: express.Request) => {
    const raw = req.query.query;
    if (typeof raw !== "string")
      throw new ReadValidationError("Supply a JSON query parameter");
    if (Buffer.byteLength(raw) > 64_000)
      throw new ReadValidationError("Query exceeds 64KB");
    try {
      const value: unknown = JSON.parse(raw);
      return value;
    } catch {
      throw new ReadValidationError("Invalid JSON query");
    }
  };
  return { respond, query };
}
