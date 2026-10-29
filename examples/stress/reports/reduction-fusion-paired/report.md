# Compatible native reduction fusion — paired benchmark

756,804 documents; 20 tenant/workload parity checks across all three executors. 720 measured responses also matched.

The same backend declarations and frontend queries run against a captured pre-change reader, the new reader, and the optimized native reference. Cyclic variant order, warm caches, one private MongoDB process. Times include HTTP and query decoding.

## Concurrency 1

| Workload | Before p50 ms | After p50 ms | Native p50 ms | Before/after | Commands before → after / native |
|---|---:|---:|---:|---:|---:|
| directory | 12.2 | 12.6 | 7.3 | 0.97× | 1 → 1 / 1 |
| finances | 102.1 | 98.7 | 58.4 | 1.03× | 10 → 10 / 6 |
| risk | 225.8 | 225.9 | 75.5 | 1.00× | 25 → 25 / 10 |
| account360 | 184.8 | 182.4 | 32.1 | 1.01× | 6 → 6 / 12 |
| orderOps | 137.2 | 140.0 | 29.7 | 0.98× | 4 → 4 / 6 |
| replenishment | 139.6 | 136.8 | 47.9 | 1.02× | 11 → 11 / 7 |
| revenueQuality | 298.3 | 139.1 | 68.0 | 2.14× | 22 → 10 / 5 |
| fulfillment | 2811.7 | 2812.2 | 142.5 | 1.00× | 52 → 52 / 5 |
| nestedTriage | 130.6 | 114.8 | 22.1 | 1.14× | 13 → 13 / 8 |
| portfolioConcentration | 319.7 | 318.2 | 46.4 | 1.00× | 15 → 15 / 5 |

## Concurrency 4

| Workload | Before p50 ms | After p50 ms | Native p50 ms | Before/after | Commands before → after / native |
|---|---:|---:|---:|---:|---:|
| directory | 19.7 | 19.6 | 12.0 | 1.01× | 1 → 1 / 1 |
| finances | 158.7 | 150.2 | 91.3 | 1.06× | 10 → 10 / 6 |
| risk | 302.1 | 301.3 | 135.0 | 1.00× | 25 → 25 / 10 |
| account360 | 217.1 | 212.9 | 69.1 | 1.02× | 6 → 6 / 12 |
| orderOps | 202.6 | 197.7 | 69.2 | 1.03× | 4 → 4 / 6 |
| replenishment | 183.1 | 185.1 | 71.7 | 0.99× | 11 → 11 / 7 |
| revenueQuality | 368.7 | 184.3 | 103.0 | 2.00× | 22 → 10 / 5 |
| fulfillment | 3495.9 | 3296.0 | 535.1 | 1.06× | 52 → 52 / 5 |
| nestedTriage | 148.2 | 155.5 | 36.8 | 0.95× | 13 → 13 / 8 |
| portfolioConcentration | 458.4 | 475.0 | 86.7 | 0.97× | 15 → 15 / 5 |

## Limits

- Local synthetic data, warm caches, small fixed-wave samples; not a production capacity claim
- All three executors share a process, driver pool and database; variant order rotates but no cold-cache isolation
- The native reference is hand-optimized for fixed dashboard views
- Per-request summed Mongo durations can overlap; p95 estimates need more samples for stability
- Captured pre-change reader shares unchanged demo models, policies and callbacks with the current implementation

See report.json for raw samples, source hashes, plans and untimed command traces.
