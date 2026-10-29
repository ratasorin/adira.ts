import {
  Activity,
  Database,
  List,
  Network,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { formatBytes, formatNumber } from "../../lib/format";

function Metric({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardContent className="flex items-start justify-between p-5">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
        </div>
        <span className="rounded-md bg-muted/70 p-2 text-muted-foreground">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

export function Metrics({
  count,
  clientMs,
  commands,
  bytes,
}: {
  count?: number;
  clientMs?: number;
  commands?: number;
  bytes?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric
        title="Rows returned"
        value={count === undefined ? "—" : String(count)}
        icon={List}
      />
      <Metric
        title="Response time"
        value={clientMs === undefined ? "—" : `${formatNumber(clientMs, 1)} ms`}
        icon={Activity}
      />
      <Metric
        title="Database commands"
        value={commands === undefined ? "—" : String(commands)}
        icon={Database}
      />
      <Metric
        title="Response size"
        value={bytes === undefined ? "—" : formatBytes(bytes)}
        icon={Network}
      />
    </div>
  );
}
