import { useId } from "react";
import type { BoundSelection } from "../../controls/table-controls";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";
import { FilterControls } from "./filter-group";
import { PageControls } from "./pagination";
import { SortButtons } from "./sort-buttons";

export function SelectionControls({
  control,
  path = "",
  nested = false,
}: {
  control: BoundSelection;
  path?: string;
  nested?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {control.columns.map((column) => (
          <div
            key={column.key}
            className="flex min-w-0 items-center justify-between gap-1"
          >
            <label
              htmlFor={`${id}-${column.key}`}
              className="flex min-w-0 items-center gap-2.5 text-xs"
            >
              <Checkbox
                id={`${id}-${column.key}`}
                aria-label={`Show ${path}${column.key}`}
                checked={column.selected}
                disabled={column.disabled}
                onCheckedChange={column.toggle}
              />
              <span className="truncate" title={column.label}>
                {column.label}
              </span>
            </label>
            {nested && column.sorting && (
              <SortButtons field={column.key} sorting={column.sorting} />
            )}
          </div>
        ))}
      </div>
      {control.relations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground">
            Relations
          </h3>
          {control.relations.map((relation) => (
            <div className="rounded-lg border" key={relation.key}>
              <label className="flex items-center gap-2.5 p-3 text-sm font-medium">
                <Checkbox
                  aria-label={`Include ${path}${relation.key}`}
                  checked={relation.selected}
                  disabled={relation.disabled}
                  onCheckedChange={relation.toggle}
                />
                {relation.label}
                <Badge
                  variant="secondary"
                  className="ml-auto font-normal text-muted-foreground"
                >
                  {relation.many ? "Many" : "One"}
                </Badge>
              </label>
              {relation.child && (
                <div className="space-y-4 border-t p-3">
                  <SelectionControls
                    control={relation.child.selection}
                    path={`${path}${relation.key}.`}
                    nested
                  />
                  <FilterControls group={relation.child.filters} />
                  {relation.child.page && (
                    <PageControls
                      page={relation.child.page}
                      title={`${relation.label} limit`}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
