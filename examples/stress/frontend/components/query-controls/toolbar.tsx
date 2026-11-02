import { Columns3, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { BoundInputs } from "../../controls/table-controls";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { FilterControls } from "./filter-group";
import { SelectionControls } from "./selection";

export function QueryControls({ controls }: { controls: BoundInputs }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const selected = controls.selection.columns.filter(
    (column) => column.selected,
  ).length;
  return (
    <div className="flex items-center gap-2">
      <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <SlidersHorizontal />
            Filters
            {controls.filters.children.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 py-0 text-[10px]"
              >
                {controls.filters.children.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={16}
          className="max-h-[min(600px,calc(100svh-8rem))] w-[min(650px,calc(100vw-2rem))] space-y-3 overflow-y-auto p-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Filters</h2>
            {controls.filters.children.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={controls.filters.clear}
              >
                Clear filters
              </Button>
            )}
          </div>
          <div className="table-filters">
            <FilterControls group={controls.filters} />
          </div>
        </PopoverContent>
      </Popover>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm">
            <Columns3 />
            Columns
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
              {selected}
            </Badge>
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full gap-0 sm:max-w-lg">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Columns & relations</SheetTitle>
            <SheetDescription className="sr-only">
              Visible fields and related records
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <SelectionControls control={controls.selection} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
