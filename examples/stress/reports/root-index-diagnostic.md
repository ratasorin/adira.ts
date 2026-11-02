# Starting-query index comparison

This is the diagnostic before index lowering. The compiler change is now implemented; the [fresh before/after comparison](index-lowering-comparison.md) records indexed root plans and the resulting HTTP timings, including regressions.

The required indexes exist. On the same freshly seeded medium database, the reference backend's starting queries use them, while Adira's root cursors use collection scans. This confirms that the current generated predicate shape misses an optimization available to the reference queries.

| View             | Adira documents examined | Reference documents examined | Candidates returned by both |
| ---------------- | -----------------------: | ---------------------------: | --------------------------: |
| Service risk     |                    6,000 |                          730 |                         486 |
| Order operations |                  120,000 |                          749 |                         668 |
| Replenishment    |                    8,000 |                          356 |                         356 |

Adira reports `COLLSCAN` and zero index keys examined for all three root cursors. The reference queries report `IXSCAN` using these existing indexes:

- Accounts: `{ tenantId: 1, deletedAt: 1, region: 1, name: 1 }`.
- Orders: `{ tenantId: 1, deletedAt: 1, region: 1, placedAt: -1 }`.
- Products: `{ tenantId: 1, deletedAt: 1, category: 1, active: 1, sku: 1 }`.

The reference uses ordinary field predicates. Adira's source policy and base filters use aggregation expressions with null-normalized field comparisons, which do not yield useful leading index bounds in these measured plans. This does not mean all `$expr` predicates are unindexable. Adira's foreign lookups also already use indexes.

The proposed compiler change would emit suitable indexed necessary filters for supported base predicates while retaining exact checks where Mongo matching semantics differ. Additional indexes are not required to demonstrate the present opportunity. This diagnostic does not implement that change or predict resulting endpoint latency.

The [raw diagnostic](root-index-diagnostic.json) contains index definitions, reference query filters/sorts, full explain output for both implementations, and dataset metadata. It used 756,804 documents on one private MongoDB instance with the existing seed/index creation code, without hints or index changes. Reference queries reproduce the starting `find` calls in [reference.ts](../server/accounts/details.reference.ts); Adira uses the compiled root pipelines for the corresponding workloads.

The comparison measures starting-collection access. Reference statistics exclude later aggregates, JavaScript scoring, and display reads; the Adira numbers are its root cursor statistics and exclude foreign lookups and later application work. Both implementations still need the appropriate computed values before selecting these pages.
