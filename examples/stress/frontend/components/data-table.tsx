import { readRecord } from "@n/adira.core.ts";
import { ArrowUpRight, Inbox, Link2 } from "lucide-react";
import type { TableColumn } from "../controls/table-controls";
import { formatNumber } from "../lib/format";
import { cn } from "../lib/utils";
import { SortButtons } from "./query-controls/sort-buttons";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

export function DataTable<Row>({
  rows,
  columns,
  loading,
  offset,
  onOpen,
}: {
  rows: readonly Row[];
  columns: readonly TableColumn<NoInfer<Row>>[];
  loading: boolean;
  offset: number;
  onOpen: (row: NoInfer<Row>, trigger: HTMLButtonElement) => void;
}) {
  return (
    <div className="data-table min-w-0" aria-busy={loading}>
      <Table containerClassName="max-h-[calc(100svh-390px)] min-h-64 overflow-auto">
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow className="bg-muted/35 hover:bg-muted/35">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className="h-11 whitespace-nowrap px-4 text-xs font-medium"
                aria-sort={
                  column.sorting?.direction === "asc"
                    ? "ascending"
                    : column.sorting?.direction === "desc"
                      ? "descending"
                      : "none"
                }
              >
                <div className="flex items-center gap-2">
                  <span>{column.label}</span>
                  {column.sorting && (
                    <SortButtons field={column.key} sorting={column.sorting} />
                  )}
                </div>
              </TableHead>
            ))}
            <TableHead className="w-10">
              <span className="sr-only">Record details</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index} className="group">
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className="h-14 whitespace-nowrap px-4 text-[13px]"
                >
                  <Cell field={column.key} value={column.read(row)} />
                </TableCell>
              ))}
              <TableCell className="px-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground group-hover:text-foreground"
                  aria-label={`Open record ${offset + index + 1}`}
                  onClick={(event) => onOpen(row, event.currentTarget)}
                >
                  <ArrowUpRight className="size-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {loading &&
            !rows.length &&
            Array.from({ length: 8 }, (_, index) => (
              <TableRow key={`loading-${index}`}>
                {columns.map((column) => (
                  <TableCell key={column.key} className="h-14 px-4">
                    <Skeleton className="h-3.5 w-24" />
                  </TableCell>
                ))}
                <TableCell />
              </TableRow>
            ))}
          {!rows.length && !loading && (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="h-64">
                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <span className="rounded-xl border bg-muted/40 p-3">
                    <Inbox className="size-5" />
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    No matching records
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

const statusColors: Readonly<Record<string, string>> = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  shipped: "border-blue-200 bg-blue-50 text-blue-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  watch: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-red-200 bg-red-50 text-red-700",
  backorder: "border-red-200 bg-red-50 text-red-700",
  cancelled: "border-zinc-200 bg-zinc-50 text-zinc-500",
  open: "border-blue-200 bg-blue-50 text-blue-700",
  enterprise: "border-violet-200 bg-violet-50 text-violet-700",
  growth: "border-blue-200 bg-blue-50 text-blue-700",
};

export function Cell({ field, value }: { field: string; value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground/60">—</span>;
  if (Array.isArray(value))
    return (
      <Badge
        variant="outline"
        className="gap-1.5 font-normal text-muted-foreground"
      >
        <Link2 className="size-3" />
        {value.length} records
      </Badge>
    );
  if (typeof value === "object") {
    const row = readRecord(value, "related record");
    return (
      <span className="text-sm font-medium">
        {String(row.name ?? row.sku ?? "Record")}
      </span>
    );
  }
  if (typeof value === "boolean")
    return (
      <Badge
        variant="outline"
        className={cn(
          "font-normal",
          value ? statusColors.healthy : "text-muted-foreground",
        )}
      >
        {String(value)}
      </Badge>
    );
  if (["riskBand", "stockStatus", "status", "tier"].includes(field))
    return (
      <Badge
        variant="outline"
        className={cn("font-normal capitalize", statusColors[String(value)])}
      >
        {String(value)}
      </Badge>
    );
  if (field === "id")
    return (
      <code className="text-[11px] text-muted-foreground">
        {String(value).slice(-8)}
      </code>
    );
  if (field.endsWith("Cents") && typeof value === "number")
    return (
      <span className="font-medium tabular-nums">
        ${formatNumber(value / 100, 2)}
      </span>
    );
  if (field.endsWith("Bps") && typeof value === "number")
    return (
      <span className="tabular-nums">{formatNumber(value / 100, 1)}%</span>
    );
  if (field === "name")
    return <span className="font-medium text-foreground">{String(value)}</span>;
  return (
    <span
      className={
        typeof value === "number" ? "tabular-nums" : "text-muted-foreground"
      }
    >
      {String(value)}
    </span>
  );
}
