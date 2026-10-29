import type { ReadData, ReadQuery, ResourceLike } from "@n/adira.core.ts";
import {
  ChevronLeft,
  ChevronRight,
  Code2,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DataTable } from "../../components/data-table";
import { PageControls, QueryControls } from "../../components/query-controls";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { NativeSelect } from "../../components/ui/native-select";
import type { Screen } from "../../controls/screen";
import type { Catalog } from "../../lib/catalog";
import { formatNumber } from "../../lib/format";
import { Metrics } from "./metrics";
import { QuerySheet } from "./query-sheet";
import { RecordSheet } from "./record-sheet";
import { useRecords, type ReadBackend } from "./use-records";

export function ResourceDashboard<
  R extends ResourceLike,
  Values,
  Q extends ReadQuery<R>,
>({
  table,
  catalog,
  tenant,
}: {
  table: Screen<R, Values, Q>;
  catalog: Catalog | undefined;
  tenant: number;
}) {
  type Row = ReadData<R, Q>["rows"][number];
  const [backend, setBackend] = useState<ReadBackend>("adira");
  const [inspector, setInspector] = useState(false);
  const [expanded, setExpanded] = useState<Row>();
  const recordTrigger = useRef<HTMLButtonElement>(null);
  const queryTrigger = useRef<HTMLButtonElement>(null);
  const records = useRecords(table, catalog, tenant, backend);
  const { bound, data, rows, loading, ready } = records;
  const page = bound.page;
  useEffect(() => setExpanded(undefined), [records.requestKey]);
  const title =
    expanded === undefined
      ? "Record"
      : String(
          bound.columns
            .find((column) => ["name", "number", "sku"].includes(column.key))
            ?.read(expanded) ?? "Record",
        );

  return (
    <section className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 xl:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
            {table.title}
          </h1>
          <Badge
            variant="secondary"
            className="font-normal tabular-nums"
            role="status"
          >
            {loading ? "Loading…" : `${rows.length} rows`}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            ref={queryTrigger}
            variant="outline"
            onClick={() => setInspector(true)}
          >
            <Code2 />
            Query
          </Button>
          <Button disabled={!ready || loading} onClick={records.refresh}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>
      <Metrics
        count={data?.rows.length}
        clientMs={data?.clientMs}
        commands={data?.telemetry.commands}
        bytes={data?.bytes}
      />
      <Card className="gap-0 overflow-hidden py-0 shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <QueryControls controls={bound} />
          <div className="flex items-center gap-2">
            {table.entity === "orders" && (
              <NativeSelect
                aria-label="Implementation"
                value={backend}
                onChange={(event) =>
                  setBackend(
                    event.target.value === "adira-batched"
                      ? "adira-batched"
                      : "adira",
                  )
                }
              >
                <option value="adira">Adira</option>
                <option value="adira-batched">Adira batch</option>
              </NativeSelect>
            )}
            <Button variant="ghost" size="sm" onClick={records.reset}>
              <RotateCcw />
              Reset
            </Button>
          </div>
        </div>
        {bound.sort && (
          <div className="flex items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
            Sorted by{" "}
            <Badge variant="secondary" className="gap-1 font-normal">
              {bound.sort.label}
              <button aria-label="Clear sort" onClick={bound.sort.clear}>
                <X className="size-3" />
              </button>
            </Badge>
          </div>
        )}
        {records.error && (
          <div
            role="alert"
            className="m-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {records.error}
          </div>
        )}
        {catalog?.mode === "reference" && (
          <div role="alert" className="m-4 rounded-lg border p-3 text-sm">
            Dynamic queries require the Adira backend.
          </div>
        )}
        <DataTable
          rows={rows}
          columns={bound.columns}
          loading={loading}
          offset={page?.offset ?? 0}
          onOpen={(row, trigger) => {
            recordTrigger.current = trigger;
            setExpanded(row);
          }}
        />
        {page && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
            <PageControls page={page} />
            <div className="flex items-center gap-3">
              <span className="text-xs tabular-nums text-muted-foreground">
                {rows.length
                  ? `${formatNumber(page.offset + 1)}–${formatNumber(page.offset + rows.length)}`
                  : "0"}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || page.offset === 0}
                onClick={() =>
                  page.setOffset(Math.max(0, page.offset - page.limit))
                }
              >
                <ChevronLeft />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || rows.length < page.limit}
                onClick={() => page.setOffset(page.offset + page.limit)}
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </Card>
      <RecordSheet
        row={expanded}
        title={title}
        close={() => setExpanded(undefined)}
        trigger={recordTrigger}
      />
      <QuerySheet
        open={inspector}
        onOpenChange={setInspector}
        queryText={records.queryText}
        requestKey={records.requestKey}
        entity={table.entity}
        tenant={tenant}
        backend={backend}
        ready={ready}
        telemetry={data?.telemetry}
        trigger={queryTrigger}
      />
    </section>
  );
}
