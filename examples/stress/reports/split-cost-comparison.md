# Splitting the independent cost producer

Revenue/refunds/order count and line-item cost are now registered as separate native producers. Net revenue is derived before the cost producer. This lets existing dependency pruning remove costs from revenue-only views and existing safe native pagination delay margin's display-only cost lookup. The executor, count/sum strategies, dependency scheduling, frontend queries, reference implementation, and database indexes are unchanged.

## Benchmark method

Fresh before/after runs use the same deterministic medium dataset: **756,804 documents**, four tenants, the same business snapshot and indexes. Twelve timed samples per backend/view/concurrency, two warmups, concurrency 1 and 4: **288 responses per run, 576 total**. The baseline completed before rebuilding the split source. Each run creates and cleans up its own private MongoDB instance; no build/test workload runs concurrently with timing.

All twelve expected result digests match between runs, and every timed response matches its expected digest. Dataset parameters, index definitions, settings, candidate counts, callback counts, driver command counts, and the complete-history budget outcome match. This is an application modeling change using existing planner capabilities, not a new optimization pass.

Environment: Node 24.14.0, MongoDB 8.2.1, AMD Ryzen 5 PRO 3500U, eight logical CPUs, about 7.7 GB memory, 0.25 GB WiredTiger cache. These sequential local runs are exploratory. Reference timings and unchanged views vary materially, so percentages are observed differences rather than isolated causal estimates or stable production guarantees.

Artifacts: [before report](split-cost-before/report.md), [before raw data/plans](split-cost-before/report.json), [after report](split-cost-after/report.md), [after raw data/plans](split-cost-after/report.json).

```sh
npm run stress:bench -- --profile medium --iterations 12 --warmup 2 --concurrency 1,4 --explain --output reports/split-cost-before
npm run stress:bench -- --profile medium --iterations 12 --warmup 2 --concurrency 1,4 --explain --output reports/split-cost-after
```

Run those commands against the corresponding source versions. The baseline includes index lowering and the original atomic revenue/cost producer.

## HTTP latency

Median end-to-end milliseconds at concurrency 1; negative change means faster:

| View             | Adira before | Adira after | Change | Reference before | Reference after |
| ---------------- | -----------: | ----------: | -----: | ---------------: | --------------: |
| Directory        |         10.5 |        11.4 |  +8.7% |              7.1 |             5.1 |
| Revenue/margin   |        344.4 |       183.3 | -46.8% |             56.7 |            53.8 |
| Service risk     |       1022.3 |       895.2 | -12.4% |             78.7 |            62.2 |
| Account 360°     |        245.7 |       187.2 | -23.8% |             31.3 |            31.9 |
| Order operations |        150.5 |       120.1 | -20.2% |             26.7 |            27.0 |
| Replenishment    |        587.9 |       548.9 |  -6.6% |             45.4 |            64.8 |

Concurrency 4:

| View             | Adira before | Adira after | Change | Reference before | Reference after |
| ---------------- | -----------: | ----------: | -----: | ---------------: | --------------: |
| Directory        |         18.0 |        18.7 |  +4.0% |             11.5 |            10.9 |
| Revenue/margin   |        405.3 |       239.9 | -40.8% |             93.3 |            83.4 |
| Service risk     |       1279.2 |       894.0 | -30.1% |            136.8 |           113.3 |
| Account 360°     |        276.3 |       219.5 | -20.6% |             76.8 |            61.7 |
| Order operations |        200.7 |       203.0 |  +1.1% |             73.6 |            86.4 |
| Replenishment    |        652.3 |       969.4 | +48.6% |             62.6 |            70.8 |

Revenue/margin improves approximately 47% at concurrency 1 and 41% at concurrency 4. Service Risk improves approximately 12% and 30%; Account 360° improves approximately 24% and 21%. The reference remains substantially faster. The larger change at concurrency 4 for risk is partly accompanied by faster reference timings and should not be treated as a precisely isolated effect.

Directory, order operations, and replenishment have **identical inspected plans** before/after and unchanged callbacks/command counts. Their timings move in both directions, including replenishment worsening from 652.3 to 969.4 ms at concurrency 4. That regression is retained in the report. These observations demonstrate substantial benchmark variability; the structural work reductions below provide stronger attribution than timing percentages alone.

## Work actually removed

Only the independent cost lookup changes these counters:

| View           | Cost lookup parents before → after | Cost line documents examined before → after |
| -------------- | ---------------------------------: | ------------------------------------------: |
| Revenue/margin |                           486 → 30 |                              10,472 → 4,908 |
| Service Risk   |                            486 → 0 |                                  10,472 → 0 |
| Account 360°   |                             12 → 0 |                                   2,080 → 0 |

The financial page needs margin, so it still computes costs, now after its selected 30 accounts. High-volume accounts on that page retain a substantial fraction of the line data; a 94% reduction in lookup parents does not imply a 94% reduction in examined lines.

Service Risk and Account 360° need net revenue but neither cost nor margin, so their cost lookup disappears entirely. Account 360° still reads order lines for its displayed nested orders; the table concerns financial cost enrichment, not every use of Lines.

Revenue lookup work stays unchanged: 486 accounts/2,618 order documents in finance and risk, and 12 accounts/520 documents in Account 360°. Root candidate counts stay 486/486/486/365/668/356 for directory/finance/risk/account/orders/replenishment. Risk still scores 486 candidates, computes two managed counts and exposure, then chooses 25. Its 18 driver commands and four exposure callbacks remain unchanged. These are the remaining costs motivating the two proposed follow-ups.

## Implementation and validation

The [source](../server/accounts/details.adira.ts) now has this registration order:

```text
account source → revenue/refund/count producer → net revenue → cost producer
```

Fields produced by the same Orders aggregation remain together. The independent Lines aggregation has its own output schema and dependencies. `FinanceIntermediate`, typed context, resource bindings, and selected frontend response types continue to infer through the same API.

- `npm run stress:build` passed core/backend/client builds, stress server/frontend TypeScript checking, and the production frontend build.
- `npm run stress:test` passed all **12 integration cases**. The new case verifies through actual MongoDB executionStats that revenue consumers skip costs, while margin's cost lookup executes only for its selected financial page. Existing cases check selected JSON parity against the independent reference in two tenants.
- Both full medium runs passed all twelve parity checks and all 576 timed-result digest checks.
- The history diagnostic still reports 479 candidates against a limit of 400, with `ReadBudgetError` and reference value 82,862.

## Proposed next work

The [bulk reduction and load-scheduling proposal](../../../docs/bulk-reductions-and-load-scheduling.md) explains the next two ideas. Neither is implemented in this change.

For eligible simple native count/sum dependencies, group foreign rows once per parent batch and map groups back to parent references. Preserve exact policies, field versions, validation, empty-input behavior, and correlation. Keep the existing parent-scoped strategy as an automatic fallback for arbitrary workflows. The frontend and `.count()` / `.sum()` syntax do not need to change.

For scheduling, begin with adjacent independent load stages whose effects permit concurrency. Built-in deterministic reads can qualify automatically; custom callbacks remain ordered unless explicitly declared safe. Shared field reads are fine, while dependency/output overwrites and opaque stages are barriers. Use bounded load concurrency and validate/attach results in original registration order. This changes execution rather than intermediate/public TypeScript types.

Neither proposal automatically replaces the raw per-parent revenue lookup with bulk revenue fetching or overlaps that native prefix with application loads. Those remain additional opportunities if the goal is to approach the reference's whole-request strategy.
