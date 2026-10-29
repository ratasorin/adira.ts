import { Braces, Plus, X } from "lucide-react";
import type { BoundFilterGroup } from "../../controls/filter-state";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { NativeSelect } from "../ui/native-select";
import { RuleControl } from "./filter-rule";

export function FilterControls({
  group,
  depth = 0,
}: {
  group: BoundFilterGroup;
  depth?: number;
}) {
  if (!group.addFilter) return null;
  return (
    <div className="filter-group space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          size="sm"
          aria-label={depth ? "Group matching" : "Filter matching"}
          value={group.operator}
          onChange={(event) =>
            group.setOperator(event.target.value === "$or" ? "$or" : "$and")
          }
        >
          <option value="$and">Match all</option>
          <option value="$or">Match any</option>
        </NativeSelect>
        <label className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox
            checked={group.negated}
            onCheckedChange={(checked) => group.setNegated(checked === true)}
          />
          Not
        </label>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={group.addFilter}
          >
            <Plus />
            Add filter
          </Button>
          {depth < 3 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Add filter group"
              onClick={group.addGroup}
            >
              <Braces />
              Group
            </Button>
          )}
        </div>
      </div>
      {group.children.map((child, index) =>
        child.kind === "rule" ? (
          <RuleControl key={index} rule={child.rule} onRemove={child.remove} />
        ) : (
          <div className="flex items-start gap-2" key={index}>
            <div className="min-w-0 flex-1">
              <FilterControls group={child.group} depth={depth + 1} />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Remove filter group"
              onClick={child.remove}
            >
              <X />
            </Button>
          </div>
        ),
      )}
    </div>
  );
}
