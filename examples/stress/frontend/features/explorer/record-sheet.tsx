import { readRecord } from "@n/adira.core.ts";
import type { RefObject } from "react";
import { Cell } from "../../components/data-table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { label } from "../../controls/filter-state";

export function RecordSheet({
  row,
  title,
  close,
  trigger,
}: {
  row: unknown;
  title: string;
  close: () => void;
  trigger: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <Sheet
      open={row !== undefined}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent
        className="w-full gap-0 sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="sr-only">
            Record details
          </SheetDescription>
        </SheetHeader>
        {row !== undefined && (
          <Tabs defaultValue="details" className="min-h-0 flex-1 gap-0">
            <div className="px-6 py-4">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="details" className="overflow-y-auto px-6 pb-6">
              <dl className="divide-y">
                {Object.entries(readRecord(row, "record")).map(
                  ([field, value]) => (
                    <div
                      key={field}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 py-4 text-sm"
                    >
                      <dt className="text-muted-foreground">{label(field)}</dt>
                      <dd className="min-w-0 break-words font-medium">
                        <Cell field={field} value={value} />
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            </TabsContent>
            <TabsContent
              value="json"
              className="min-h-0 overflow-auto px-6 pb-6"
            >
              <pre className="code-panel">{JSON.stringify(row, null, 2)}</pre>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
