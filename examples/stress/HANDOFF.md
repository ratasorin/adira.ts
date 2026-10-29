# Stress example handoff

## Reading route

Start with [README.md](README.md), then [contracts/resources.ts](contracts/resources.ts). Server code is scoped to `accounts/`, `orders/`, and `products/`. Matching `.adira.ts` and `.reference.ts` files live beside each other; `rules.ts` holds the area's shared formulas and `*.provider.ts` holds its custom MongoDB batches.

For example, compare [account finance](server/accounts/finance.adira.ts) with [its reference](server/accounts/finance.reference.ts), or [fulfillment](server/orders/fulfillment.adira.ts) with [its reference](server/orders/fulfillment.reference.ts). The [batched fulfillment alternative](server/orders/fulfillment-batched.adira.ts) is in the same order folder.

Adira files compose reusable resource fields and dependencies; native reference endpoints implement fixed benchmark views. Their requests are in [harness/workloads](harness/workloads/index.ts). [readers.adira.ts](harness/readers.adira.ts) and [readers.reference.ts](harness/readers.reference.ts) only dispatch to the business modules. The [smaller query pairs](queries/index.ts) and [comparison docs](docs/query-comparisons.md) are useful entry points.

## Infrastructure boundary

| Area                                            | Role                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `harness/seed.ts`, `mongo.ts`, `demo.ts`        | Fixed-clock synthetic commerce data and private local MongoDB lifecycle.                          |
| `harness/http/`                                 | Local Express routes, tenant-header context, response telemetry, and diagnostics.                 |
| `harness/workloads/`                            | Ten fixed benchmark requests and deliberate rejection probes. The dashboard does not import them. |
| `harness/benchmarks/`                           | Scheduling, parity digests, snapshots, source provenance, and report files.                       |
| `harness/generate-controls.ts`                  | Example schema-to-parser/visibility generation; no published generator feature is implied.        |
| `frontend/controls/`, `screens/`, `components/` | Example state adapters and rendering choices.                                                     |

The trusted `x-tenant-index` header selects a seeded tenant. It is not an authentication implementation. The snapshot is fixed at 2026-10-01; financial/sales windows use ninety days and recent order operations use thirty days.

Custom batch providers and formulas are real application logic. They remain application-owned even where Adira generalizes planning, validation, policies, and response inference. Typed raw MongoDB stages still rely on the provider author's declared inputs/outputs.

## Frontend changes

The four responsibilities remain separate:

1. `generated/controls.ts` provides headless field/operator parsers. `controls/input-controls.ts` and `filter-controls.ts` implement parsing, validation, and formatting.
2. `queries/` builds ordinary query literals using `deriveQuery` and `when`.
3. `screens/` binds the example's state, columns, sort arrows, and relation controls. `generated/dashboard-filters.ts` and `controls/filter-state.ts` are optional dashboard adapters.
4. `features/explorer/` fetches and renders query-inferred rows through the generic `DataTable`.

Keep literal callback return types inferred. A broad `ReadQuery` return annotation loses selected-field precision. Use `InferRow<typeof loader>` when the loader returns a response with `rows`. Conditional fields remain optional; nullable relations remain nullable. JSON enters the frontend API through `unknown` and is validated before it becomes a typed selected response.

Queries start with no `where` or `orderBy`. Sorting changes only through explicit controls; hiding a sorted column clears it. Invalid drafts block requests. Disabled includes do not evaluate child query callbacks. Child collection filters, ordering, limits, and offsets are independent of their parent page.

The UI uses [shadcn/ui](https://ui.shadcn.com/docs) registry components, Radix primitives, Lucide icons, and Tailwind v4. `components.json` records the component setup; tokens are in [globals.css](frontend/styles/globals.css). The components and their MIT license are in `frontend/components/ui/`. The headless parsers impose no renderer or controlled/uncontrolled state model.

Regenerate after contract changes:

```sh
npm run generate:controls -w examples/stress
npm run check:controls -w examples/stress
```

Custom schemas without portable metadata need a typed parser in `frontend/controls/control-overrides.ts`. The generated code exposes missing or mismatched registrations to TypeScript.

## Development and verification

From the repository root:

```sh
npm run stress:build
npm run stress:demo -- --profile smoke
```

The demo serves the built frontend at http://127.0.0.1:5400. Use `--profile medium` for the full dataset or `--port 5401` for another port. `MONGOD_BINARY` selects a local binary if it is not on PATH. The build removes only this example's `dist/` before compiling, so old files cannot shadow newly introduced directories.

For frontend development, keep the demo running and start `npm run dev -w examples/stress`; Vite proxies `/api` to port 5400.

```sh
npm run stress:test
npm exec -w examples/stress -- playwright install chromium
npm run test:browser -w examples/stress
```

There are 19 control tests and 39 integration cases, including twelve query pairs in two tenants. Browser checks run the same eight scenarios on desktop and mobile. Browser tests start an isolated smoke demo on port 5410, or reuse one already running there. They expect the default Adira-capable smoke server. Type fixtures are in `tests/types/` and are checked by the server/frontend builds. Browser tests and configuration have their own TypeScript check.

For an existing database:

```sh
npm run stress:seed -- --profile medium --uri mongodb://127.0.0.1:27017/adira_stress_local
npm run stress:serve -- --uri mongodb://127.0.0.1:27017/adira_stress_local --port 5400
```

Seeding accepts only `adira_stress` / `adira_stress_*` database names and refuses existing stress data unless `--reset` is explicit. `--reset` replaces named stress collections, not unrelated collections. `--backend adira` / `reference` selects a single implementation; reference-only mode serves the fixed reference endpoints.

## Benchmarks

The [benchmark index](docs/benchmarks.md) links original reports, traces, audits, first trials, and surviving compiled snapshots. Raw historical JSON is preserved. Its paths and source hashes describe the measured version; source files have since moved. The report-adjacent scripts are historical artifacts. Use the current TypeScript runners for new measurements.

```sh
npm run stress:bench -- --profile medium --iterations 24 --warmup 2 --concurrency 1,4 --explain --output results/my-run
```

The runner seeds privately, checks the first/last tenants, validates every measured response, then captures untimed plans and commands. `--workloads directory,risk` narrows the run. `--uri` reuses an existing seed; add `--seed` only when deliberately seeding it. Use a new output directory for each experiment.

For a future paired executor comparison, capture the built baseline before changing the library:

```sh
npm run stress:build
npm run benchmark:fusion -w examples/stress -- --capture-baseline
```

After the library change, rebuild and run:

```sh
npm run stress:build
npm run benchmark:fusion -w examples/stress -- --profile medium --iterations 12 --warmup 2 --concurrency 1,4 --output results/my-fusion-run
```

Capture stores the reader and modular demo graph under root `node_modules/.adira-fusion-baseline.*`; the manifest defaults to `node_modules/.adira-fusion-baseline.json`. `--baseline /absolute/path/manifest.json` selects a separate manifest. Snapshots survive a stress build; dependency reinstallation can remove them. Capture replaces the selected manifest. Manifests from an older directory layout require a new capture. The runner rejects changed business/query sources between capture and comparison.

Normal reductions and includes use batches of 128. The alternative fulfillment provider uses 1,024; it implements the same public contract, with different application batching. The recorded fusion improvement combines compatible consecutive scalar reductions. Independent load overlap and broader nested include reuse remain separate work.

The smoke runs used to check the reorganization are not new benchmark claims. Original medium reports remain the evidence quoted by the README.
