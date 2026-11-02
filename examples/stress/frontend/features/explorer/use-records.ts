import type { ReadData, ReadQuery, ResourceLike } from "@n/adira.core.ts";
import { useEffect, useMemo, useState } from "react";
import type { Screen } from "../../controls/screen";
import { fetchRead, type Telemetry } from "../../lib/api";
import type { Catalog } from "../../lib/catalog";

export type ReadBackend = "adira" | "adira-batched";
interface Run<Row> {
  key: string;
  rows: Row[];
  telemetry: Telemetry;
  clientMs: number;
  bytes: number;
}

export function useRecords<
  R extends ResourceLike,
  Values,
  Q extends ReadQuery<R>,
>(
  table: Screen<R, Values, Q>,
  catalog: Catalog | undefined,
  tenant: number,
  backend: ReadBackend,
) {
  type Row = ReadData<R, Q>["rows"][number];
  const [state, setState] = useState(table.initial);
  const [revision, setRevision] = useState(0);
  const [run, setRun] = useState<Run<Row>>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const compiled = useMemo(() => {
    try {
      return { query: table.query(state), error: undefined };
    } catch (error) {
      return {
        query: undefined,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [table.query, state]);
  const queryText = compiled.query
    ? JSON.stringify(compiled.query, null, 2)
    : "";
  const requestKey = `${tenant}/${backend}/${queryText}`;
  const data = run?.key === requestKey ? run : undefined;
  const bound = table.bind(state, setState);

  useEffect(() => {
    const query = compiled.query;
    setError("");
    if (!catalog || !query || catalog.mode === "reference") {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        const start = performance.now();
        try {
          const response = await fetchRead(
            table.resource,
            table.entity,
            query,
            tenant,
            backend,
            controller.signal,
          );
          if (active)
            setRun({
              key: requestKey,
              rows: response.rows,
              telemetry: response.telemetry,
              clientMs: performance.now() - start,
              bytes: new TextEncoder().encode(JSON.stringify(response)).length,
            });
        } catch (error) {
          if (active && !controller.signal.aborted)
            setError(error instanceof Error ? error.message : String(error));
        } finally {
          if (active) setLoading(false);
        }
      })();
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [compiled.query, catalog, table, tenant, backend, revision, requestKey]);

  return {
    bound,
    data,
    rows: data?.rows ?? [],
    loading,
    requestKey,
    queryText,
    error: compiled.error ?? error,
    ready: Boolean(catalog && compiled.query && catalog.mode !== "reference"),
    refresh: () => setRevision((value) => value + 1),
    reset: () => setState(table.initial()),
  };
}
