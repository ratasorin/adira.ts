import {
  Boxes,
  Building2,
  ChevronRight,
  Database,
  Menu,
  Package,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Entity } from "../contracts/resources";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { NativeSelect } from "./components/ui/native-select";
import { Separator } from "./components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./components/ui/sheet";
import { ResourceDashboard } from "./features/explorer/dashboard";
import { catalogSchema, type Catalog } from "./lib/catalog";
import { cn } from "./lib/utils";
import { screens as tables } from "./screens";

const navigation = [
  { entity: "accounts", icon: Users },
  { entity: "orders", icon: ShoppingBag },
  { entity: "products", icon: Package },
] as const;
function initialEntity(): Entity {
  const params = new URLSearchParams(location.search);
  const resource = params.get("resource");
  if (
    resource === "accounts" ||
    resource === "orders" ||
    resource === "products"
  )
    return resource;
  const view = params.get("view");
  return view === "replenishment"
    ? "products"
    : view === "orderOps" || view === "fulfillment"
      ? "orders"
      : "accounts";
}

function Navigation({
  entity,
  select,
  catalog,
}: {
  entity: Entity;
  select: (entity: Entity) => void;
  catalog?: Catalog;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-6">
        <span className="rounded-lg bg-primary p-1.5 text-primary-foreground">
          <Boxes className="size-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight text-foreground">
          adira
        </span>
        <Badge
          variant="outline"
          className="ml-auto px-1.5 text-[10px] font-medium"
        >
          DEMO
        </Badge>
      </div>
      <div className="px-4 pt-6">
        <div className="mb-5 flex items-center gap-3 rounded-lg border bg-card px-3 py-3">
          <Building2 className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Commerce</span>
        </div>
        <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Explore
        </p>
        <nav className="space-y-1">
          {navigation.map(({ entity: item, icon: Icon }) => (
            <button
              key={item}
              aria-label={tables[item].title}
              aria-current={entity === item ? "page" : undefined}
              onClick={() => select(item)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted",
                entity === item
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
              {tables[item].title}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-auto p-5">
        <Separator className="mb-4" />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="size-3.5" />
          <span className="capitalize">
            {catalog?.metadata.profile ?? "Connecting"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [entity, setEntity] = useState<Entity>(initialEntity);
  const [catalog, setCatalog] = useState<Catalog>();
  const [tenant, setTenant] = useState(0);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/catalog", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load the dataset.");
        const body: unknown = await response.json();
        setCatalog(catalogSchema.parse(body));
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : String(error));
      });
    return () => controller.abort();
  }, []);
  function changeEntity(next: Entity) {
    setEntity(next);
    setMobileOpen(false);
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("resource", next);
    history.replaceState(null, "", url);
  }
  const props = { catalog, tenant };
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-r bg-sidebar lg:block">
        <Navigation entity={entity} select={changeEntity} catalog={catalog} />
      </aside>
      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between gap-3 border-b bg-card px-4 sm:px-6 xl:px-8">
          <div className="flex items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  className="lg:hidden"
                  variant="ghost"
                  size="icon"
                  aria-label="Open navigation"
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 gap-0 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                  <SheetDescription>Commerce tables</SheetDescription>
                </SheetHeader>
                <Navigation
                  entity={entity}
                  select={changeEntity}
                  catalog={catalog}
                />
              </SheetContent>
            </Sheet>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Commerce
            </span>
            <ChevronRight className="hidden size-3.5 text-muted-foreground sm:block" />
            <span className="text-sm font-medium">{tables[entity].title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Workspace
            </span>
            <NativeSelect
              aria-label="Tenant"
              value={tenant}
              disabled={!catalog}
              onChange={(event) => setTenant(Number(event.target.value))}
            >
              {catalog?.tenants.map((tenant) => (
                <option key={tenant.index} value={tenant.index}>
                  {tenant.name}
                </option>
              )) ?? <option>Loading…</option>}
            </NativeSelect>
          </div>
        </header>
        {error && (
          <div
            role="alert"
            className="m-6 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {error}
          </div>
        )}
        {entity === "accounts" ? (
          <ResourceDashboard key={entity} table={tables.accounts} {...props} />
        ) : entity === "orders" ? (
          <ResourceDashboard key={entity} table={tables.orders} {...props} />
        ) : (
          <ResourceDashboard key={entity} table={tables.products} {...props} />
        )}
      </div>
    </div>
  );
}
