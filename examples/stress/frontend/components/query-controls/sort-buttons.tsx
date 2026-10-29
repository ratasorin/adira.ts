import { ChevronDown, ChevronUp } from "lucide-react";
import { label } from "../../controls/filter-state";
import type { BoundSort } from "../../controls/table-controls";
import { cn } from "../../lib/utils";

export function SortButtons({
  field,
  sorting,
}: {
  field: string;
  sorting: BoundSort;
}) {
  return (
    <span className="inline-flex shrink-0 flex-col -space-y-1">
      <button
        type="button"
        aria-label={`Sort ${label(field)} ascending`}
        aria-pressed={sorting.direction === "asc"}
        onClick={sorting.ascending}
        className={cn(
          "rounded-xs text-muted-foreground/45 transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring",
          sorting.direction === "asc" && "text-primary",
        )}
      >
        <ChevronUp className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={`Sort ${label(field)} descending`}
        aria-pressed={sorting.direction === "desc"}
        onClick={sorting.descending}
        className={cn(
          "rounded-xs text-muted-foreground/45 transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring",
          sorting.direction === "desc" && "text-primary",
        )}
      >
        <ChevronDown className="size-3.5" />
      </button>
    </span>
  );
}
