import mongoose, { Types } from "mongoose";
import { AsyncLocalStorage } from "node:async_hooks";
export interface CommandDetail {
  name: string;
  collection?: string;
  pipeline?: unknown;
  filter?: unknown;
  sort?: unknown;
  projection?: unknown;
  durationMs?: number;
  returned?: number;
}
export interface Trace {
  commands: number;
  mongoMs: number;
  commandNames: Record<string, number>;
  callbacks: Record<string, number>;
  started: number;
  /** Enabled only for untimed developer diagnostics. */
  details?: CommandDetail[];
}
export interface RequestContext {
  tenantId: Types.ObjectId;
  trace: Trace;
}
export const traces = new AsyncLocalStorage<Trace>();
export const newTrace = (): Trace => ({
  commands: 0,
  mongoMs: 0,
  commandNames: {},
  callbacks: {},
  started: performance.now(),
});
export function count(context: RequestContext, key: string, n = 1) {
  context.trace.callbacks[key] = (context.trace.callbacks[key] ?? 0) + n;
}
export function monitor() {
  const active = new Map<number, { trace: Trace; detail?: CommandDetail }>();
  const client = mongoose.connection.getClient();
  client.on("commandStarted", (event) => {
    const trace = traces.getStore();
    if (
      trace &&
      ["aggregate", "find", "getMore", "count"].includes(event.commandName)
    ) {
      trace.commands++;
      trace.commandNames[event.commandName] =
        (trace.commandNames[event.commandName] ?? 0) + 1;
      let detail: CommandDetail | undefined;
      if (trace.details) {
        const command = event.command;
        detail = {
          name: event.commandName,
          collection: command.aggregate ?? command.find ?? command.collection,
          pipeline: command.pipeline,
          filter: command.filter,
          sort: command.sort,
          projection: command.projection,
        };
        trace.details.push(detail);
      }
      active.set(event.requestId, { trace, detail });
    }
  });
  const finish = (event: {
    requestId: number;
    duration: number;
    reply?: { cursor?: { firstBatch?: unknown[]; nextBatch?: unknown[] } };
  }) => {
    const entry = active.get(event.requestId);
    if (entry) {
      const { trace, detail } = entry;
      trace.mongoMs += event.duration;
      if (detail) {
        detail.durationMs = event.duration;
        const batch =
          event.reply?.cursor?.firstBatch ?? event.reply?.cursor?.nextBatch;
        if (Array.isArray(batch)) detail.returned = batch.length;
      }
      active.delete(event.requestId);
    }
  };
  client.on("commandSucceeded", finish);
  client.on("commandFailed", finish);
}
