# Query strategy versus library limitations: ROI analysis

This experiment predates automatic bulk count/sum execution. The subsequent [compiler benchmark](bulk-reductions-comparison.md) measures the implemented strategy with unchanged production declarations; the results below remain the historical backend-rewrite experiment.

**Highest-ROI focused library feature: bulk execution for eligible native count/sum dependencies.** Most of the measured Service Risk gap can already be removed by backend query rewrites through the existing `resolveBatch` API. That is a capability the library supports today; the library weakness is its inefficient default execution for simple managed reductions, plus sequential scheduling of separate loads.

## Controlled existing-API experiment

The [runnable experiment](query-roi-experiment.cjs) creates a fresh private medium dataset, keeps current Adira and native reference controls, and tests four backend variants using only public APIs. No library or production reader code changed. All variants execute the same frontend Service Risk query and business score.

All six modes run in the same Node process against the same 756,804-document MongoDB seed, with two warmups each and twelve sequential measured requests each. Mode order rotates/reverses between iterations to reduce ordering bias. These are **direct executor timings, concurrency 1**, not HTTP timings or fleet throughput. Each mode first matches the reference in the first and last tenants. All twelve preflight digests match the corresponding original benchmark digests, all 72 measured results match tenant 0, and every request scores 486 candidates before selecting 25.

| Variant                                       | Median ms | p95 ms | Driver commands |
| --------------------------------------------- | --------: | -----: | --------------: |
| Current Adira, after cost split               |     721.2 |  808.9 |              18 |
| Bulk counts; native revenue retained          |     290.4 |  345.2 |              22 |
| All inputs bulk; separate sequential loaders  |     178.2 |  212.0 |              29 |
| Bulk inputs in one parallel loader; batch 128 |     101.2 |  123.5 |              29 |
| Same parallel loader; batch 512               |      76.7 |   98.7 |               9 |
| Native reference                              |      69.5 |   82.4 |              10 |

Artifacts: [raw corrected experiment](query-roi-experiment.json), [original first trial](query-roi-experiment-first-trial.json). Do not compare these timings directly to the earlier sequential HTTP benchmark. Twelve local samples are exploratory, and this does not measure concurrency-4 behavior or other dashboards.

The faster variants use a narrower risk resource reusing the original public field descriptors, not every capability of AccountResource. The parallel variants manually bundle four inputs that this particular query needs. They retain runtime schema validation and selected-output handling but do not establish equivalent field-level pruning for other queries. The diagnostic is JavaScript, not an intermediate TypeScript inference test or a completed generic optimizer.

## Attribution from command timings

The count rewrite retains the native revenue strategy and sequential execution. Mean driver-command durations in the corrected experiment:

| Work                     | Current Adira | Bulk-count variant |
| ------------------------ | ------------: | -----------------: |
| Account/revenue commands |      162.0 ms |           162.3 ms |
| Ticket counts            |      246.8 ms |            21.3 ms |
| Shipment counts          |      239.0 ms |            26.3 ms |
| Exposure commands        |       49.3 ms |            47.0 ms |

The two count phases fall from about **486 ms to 48 ms**. Their approximately 438 ms reduction accounts for nearly all of the roughly 441 ms difference in mean request time. This is stronger evidence than attributing differences between independent benchmark runs to one code change. The variant also changes summary representation/provider plumbing, so its percentage should not be presented as a guaranteed speedup from a future generic compiler patch.

The next rewrite moves revenue from its correlated native lookup into a bulk grouped query through the existing API. Median latency falls from 290 to 178 ms with fetching still sequential. The native prefix becomes an account read; revenue is grouped for parent IDs in the batch rather than starting an independent revenue pipeline for every account.

Manual bundling plus concurrent fetching then reaches 101 ms with 128-parent batches. Using the existing 512-parent batch option reaches 77 ms, versus 69 ms for the reference. The latter makes one summary callback for all 486 candidates; the 128-parent version makes four. Both still run Adira's JavaScript score, frontend Boolean filtering, ordering, pagination, and selected output validation. Differences include query shape, resource coverage, validation, and batching, so the remaining difference is not an isolated measurement of framework overhead.

More driver commands do not imply more work: the sequential bulk variant uses 29 commands and is far faster than the current 18-command plan. Parallel command durations overlap and must not be summed as request wall time.

## What is backend query design, and what is a library weakness?

| Bottleneck                                                | Better backend queries/configuration possible today?                  | Library responsibility                                                                                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Independent revenue/cost work bundled together            | Yes; already fixed by separate native producers                       | Existing dependency pruning worked as declared; producer boundaries were the application mistake                                                             |
| Per-account raw revenue lookup                            | Yes; use a bulk grouped `resolveBatch` loader                         | A raw native block specifies that strategy. Adira should not silently extract arbitrary raw stages into another execution model                              |
| Per-parent simple `tickets.count()` / `shipments.count()` | Yes, by hand-writing custom summary loaders                           | The natural declarative primitive selects an expensive strategy despite a simple optimizable relation. This is the strongest measured library default to fix |
| Sequential independent `.load()` calls                    | Yes, by combining callbacks and using Promise.all inside one provider | Separate providers cannot currently express safe overlap. The workaround sacrifices independent demand/pruning granularity                                   |
| Four batches for 486 candidates                           | Yes; batch size is configurable                                       | Bounded batching is deliberate. A larger batch is workload-specific, not an automatic universal improvement                                                  |
| Inventory scanned for both totals and warehouse count     | Yes; a shared stock group can also count rows when exact scopes agree | Compatible managed demands could eventually fuse; application authors can already group shared work explicitly                                               |
| Root index access                                         | Implemented for supported predicates                                  | Existing helper lowering is not universally beneficial inside already indexed parent lookups; profile its placement rather than adding more indexes blindly  |
| JavaScript score for all candidates before top-25         | Both backends do this                                                 | Not evidence of a library defect; exact application-defined ordering needs those values or an equivalent authoritative strategy                              |

The stock/warehouse observation is code inspection of the current replenishment implementation, not a measured replenishment rewrite in this experiment. The same distinction applies to order and nested display-query optimizations: the risk result does not prove a specific speedup for every view.

## Why the query itself still matters

The first prototype intersected the whole parent-ID set for every foreign row, including scalar keys. Its 512-parent variant took 510 ms even though it made fewer commands. The corrected query uses the matched scalar key directly and intersects only actual foreign arrays; exposure retains its original direct grouping. This brings the 512-parent variant to 77 ms. The original raw trial is preserved rather than silently discarded.

This is a concrete example of bad query construction amplifying work independently of Adira. Bulk grouping is not a magic label: correlation bookkeeping must also be efficient. The experiment normalizes matching foreign array keys for count/revenue to preserve ordinary lookup association on that path, but it does not constitute a complete malformed-data or collation conformance suite.

## Recommended investment order

1. **Bulk native reductions.** Preserve `.count()` / `.sum()` and exact policies, validation, empty-input behavior, field versions, and correlation. Add an optimized strategy for provable simple native relations, keeping the existing general path as fallback. This removes work and improves database capacity, not only request overlap. The prototype shows a large practical opportunity; its exact percentage is not a production guarantee.
2. **Rewrite the demo's remaining raw revenue/stock queries where appropriate.** This is application work using the existing API. Keep producer granularity aligned with the outputs that share actual retrieval work. It provides a stronger benchmark for the library than intentionally suboptimal custom pipelines.
3. **Bounded overlap of independent, safe loads.** Do this after reducing work. Preserve existing callback order by default and provide an explicit safety contract for custom callbacks. Unlike manual bundling, the library can retain independent field liveness. Parallelism alone can increase database pressure and is not automatically a throughput improvement.
4. **Share compatible demands and improve batch scheduling based on evidence.** Match source/policy/filter/field versions before fusing. Keep inspectable strategies and bounded candidates; do not promise one batch size or one native pipeline is always best.

A universal raw-pipeline optimizer, bypassing validation, or avoiding JavaScript should not be the next investment. The measured query can already approach the native reference without those changes. The product opportunity is to make efficient execution the default while preserving the composability and demand-driven behavior that the manual bundled workaround gives up.
