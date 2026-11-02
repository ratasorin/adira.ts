import { X } from "lucide-react";
import { label, type BoundRule } from "../../controls/filter-state";
import { FilterInput } from "../filters/filter-input";
import { Button } from "../ui/button";
import { NativeSelect } from "../ui/native-select";

const operatorLabels: Readonly<Record<string, string>> = {
  $eq: "equals",
  $ne: "does not equal",
  $in: "is in",
  $nin: "is not in",
  $gt: "greater than",
  $gte: "at least",
  $lt: "less than",
  $lte: "at most",
  $startsWith: "starts with",
  $contains: "contains",
};

export function RuleControl({
  rule,
  onRemove,
}: {
  rule: BoundRule;
  onRemove: () => void;
}) {
  return (
    <div className="filter-rule flex flex-wrap items-center gap-2">
      <NativeSelect
        aria-label="Filter field"
        value={rule.field}
        onChange={(event) =>
          rule.fields
            .find((option) => option.id === event.target.value)
            ?.choose()
        }
      >
        {rule.fields.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label={`${label(rule.field)} filter operator`}
        value={rule.operator}
        onChange={(event) =>
          rule.operators
            .find((option) => option.id === event.target.value)
            ?.choose()
        }
      >
        {rule.operators.map((option) => (
          <option key={option.id} value={option.id}>
            {operatorLabels[option.id] ?? option.id}
          </option>
        ))}
      </NativeSelect>
      <FilterInput
        input={rule.input}
        label={`${label(rule.field)} filter value`}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground"
        aria-label={`Remove ${label(rule.field)} filter`}
        onClick={onRemove}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
