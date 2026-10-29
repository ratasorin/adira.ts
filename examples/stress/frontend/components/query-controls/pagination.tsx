import type { BoundPage } from "../../controls/table-controls";
import { Input } from "../ui/input";
import { NativeSelect } from "../ui/native-select";

export function PageControls({
  page,
  title = "Rows per page",
}: {
  page: BoundPage;
  title?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <label className="flex items-center gap-2">
        {title}
        <NativeSelect
          size="sm"
          aria-label={title}
          value={page.limit}
          onChange={(event) => page.setLimit(Number(event.target.value))}
        >
          {[5, 10, 20, 40, 100].map((limit) => (
            <option key={limit} value={limit}>
              {limit}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="flex items-center gap-2">
        Offset
        <Input
          aria-label="Row offset"
          type="number"
          min={0}
          step={1}
          value={page.offset}
          onChange={(event) => page.setOffset(Number(event.target.value))}
          className="h-8 w-20 bg-card"
        />
      </label>
    </div>
  );
}
