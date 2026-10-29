import type { FilterInputProps } from "../../controls/filter-state";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { NativeSelect } from "../ui/native-select";

export function FilterInput({
  input,
  label,
}: {
  input: FilterInputProps;
  label: string;
}) {
  return (
    <div className="flex min-w-32 flex-1 items-center gap-2">
      {input.isNull ? (
        <code className="text-xs text-muted-foreground">null</code>
      ) : input.kind === "boolean" || input.kind === "enum" ? (
        <NativeSelect
          aria-label={label}
          value={input.text}
          onChange={(event) => input.onTextChange(event.target.value)}
        >
          {input.options.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </NativeSelect>
      ) : (
        <Input
          aria-label={label}
          type={input.kind === "number" ? "number" : "text"}
          step="0.01"
          placeholder={input.kind === "list" ? "EU, NA" : "Value"}
          value={input.text}
          aria-invalid={input.error !== undefined}
          onChange={(event) => input.onTextChange(event.target.value)}
          className="min-w-24"
        />
      )}
      {input.nullable && (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox
            aria-label={`${label} null`}
            checked={input.isNull}
            onCheckedChange={(checked) => input.onNullChange(checked === true)}
          />
          Null
        </label>
      )}
    </div>
  );
}
