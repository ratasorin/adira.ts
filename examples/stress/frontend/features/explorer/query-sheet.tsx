import { readRecord } from "@n/adira.core.ts";
import { Check, Copy, Play } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";
import type { Entity } from "../../../contracts/resources";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
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
import type { Telemetry } from "../../lib/api";
import { formatNumber } from "../../lib/format";
import type { ReadBackend } from "./use-records";

export function QuerySheet({
  open,
  onOpenChange,
  queryText,
  requestKey,
  entity,
  tenant,
  backend,
  ready,
  telemetry,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queryText: string;
  requestKey: string;
  entity: Entity;
  tenant: number;
  backend: ReadBackend;
  ready: boolean;
  telemetry?: Telemetry;
  trigger: RefObject<HTMLButtonElement | null>;
}) {
  const [plan, setPlan] = useState<{ key: string; value: unknown }>();
  const [diagnostic, setDiagnostic] = useState<{
    tenant: number;
    value: unknown;
  }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setError("");
    setCopied(false);
  }, [requestKey]);
  async function copyQuery() {
    try {
      await navigator.clipboard.writeText(queryText);
      setCopied(true);
    } catch {
      setError("Unable to copy the query.");
    }
  }
  async function inspect(kind: "plan" | "budget") {
    setBusy(true);
    setError("");
    const key = requestKey;
    try {
      const url =
        kind === "plan"
          ? `/api/${backend}/plan/${entity}?query=${encodeURIComponent(queryText)}`
          : "/api/diagnostics/budget";
      const response = await fetch(url, {
        headers: { "x-tenant-index": String(tenant) },
      });
      const body: unknown = await response.json();
      if (!response.ok)
        throw new Error(String(readRecord(body, "response").message));
      if (kind === "plan") setPlan({ key, value: body });
      else setDiagnostic({ tenant, value: body });
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full gap-0 sm:max-w-2xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>Query</SheetTitle>
          <SheetDescription className="sr-only">
            Request and execution
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="request" className="min-h-0 flex-1 gap-0">
          <div className="px-6 py-4">
            <TabsList className="w-full">
              <TabsTrigger value="request">Request</TabsTrigger>
              <TabsTrigger value="plan">Execution plan</TabsTrigger>
              <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
            </TabsList>
          </div>
          {error && (
            <div
              role="alert"
              className="mx-6 mb-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <TabsContent
            value="request"
            className="min-h-0 overflow-y-auto px-6 pb-6"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <Badge variant="outline">
                GET /api/{backend}/{entity}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                disabled={!queryText}
                onClick={() => void copyQuery()}
              >
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="code-panel" data-testid="request-query">
              {queryText || "Query unavailable"}
            </pre>
          </TabsContent>
          <TabsContent
            value="plan"
            className="min-h-0 overflow-y-auto px-6 pb-6"
          >
            <Button
              size="sm"
              variant="outline"
              disabled={!ready || busy}
              onClick={() => void inspect("plan")}
            >
              <Play />
              {busy ? "Inspecting…" : "Inspect plan"}
            </Button>
            {plan?.key === requestKey && (
              <pre className="code-panel mt-4">
                {JSON.stringify(plan.value, null, 2)}
              </pre>
            )}
          </TabsContent>
          <TabsContent
            value="diagnostics"
            className="min-h-0 space-y-5 overflow-y-auto px-6 pb-6"
          >
            {telemetry && (
              <div className="rounded-lg border text-sm">
                <div className="flex justify-between border-b px-4 py-3">
                  <span className="text-muted-foreground">Server</span>
                  <span className="font-mono">
                    {formatNumber(telemetry.serverMs, 1)} ms
                  </span>
                </div>
                <div className="flex justify-between border-b px-4 py-3">
                  <span className="text-muted-foreground">
                    MongoDB commands, summed
                  </span>
                  <span className="font-mono">
                    {formatNumber(telemetry.mongoMs, 1)} ms
                  </span>
                </div>
                {Object.entries(telemetry.callbacks).map(([name, count]) => (
                  <div
                    key={name}
                    className="flex justify-between border-b px-4 py-3 last:border-0"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {name}
                    </span>
                    <span className="font-mono">{count}</span>
                  </div>
                ))}
              </div>
            )}
            <div>
              <h3 className="mb-3 text-sm font-medium">Candidate budget</h3>
              <Button
                size="sm"
                variant="outline"
                disabled={!ready || busy}
                onClick={() => void inspect("budget")}
              >
                <Play />
                Run diagnostic
              </Button>
            </div>
            {diagnostic?.tenant === tenant && (
              <pre className="code-panel">
                {JSON.stringify(diagnostic.value, null, 2)}
              </pre>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
