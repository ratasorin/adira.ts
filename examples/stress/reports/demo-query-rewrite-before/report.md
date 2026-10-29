# Adira Operations Lab — medium

756,804 documents. 12 parity checks passed. 12 samples per variant/concurrency.

| Workload | Backend | Concurrency | p50 ms | p95 ms | Commands | req/s |
|---|---|---:|---:|---:|---:|---:|
| directory | adira | 1 | 19.9 | 24.3 | 1.0 | 48.5 |
| directory | reference | 1 | 14.0 | 72.0 | 1.0 | 49.8 |
| directory | adira | 4 | 62.4 | 122.2 | 1.0 | 50.3 |
| directory | reference | 4 | 49.4 | 140.4 | 1.0 | 48.0 |
| finances | reference | 1 | 89.2 | 102.7 | 6.0 | 11.1 |
| finances | adira | 1 | 432.1 | 845.9 | 1.0 | 2.1 |
| finances | reference | 4 | 265.5 | 518.8 | 6.0 | 12.3 |
| finances | adira | 4 | 743.8 | 860.1 | 1.0 | 5.2 |
| risk | adira | 1 | 636.6 | 948.9 | 18.0 | 1.5 |
| risk | reference | 1 | 105.5 | 128.0 | 10.0 | 9.0 |
| risk | adira | 4 | 1398.1 | 2375.8 | 18.0 | 2.6 |
| risk | reference | 4 | 260.8 | 481.9 | 10.0 | 12.1 |
| account360 | reference | 1 | 42.6 | 61.5 | 12.0 | 21.4 |
| account360 | adira | 1 | 353.5 | 401.2 | 5.0 | 2.8 |
| account360 | reference | 4 | 115.6 | 150.0 | 12.0 | 33.2 |
| account360 | adira | 4 | 362.8 | 389.6 | 5.0 | 10.8 |
| orderOps | adira | 1 | 213.3 | 224.6 | 4.0 | 4.7 |
| orderOps | reference | 1 | 38.2 | 47.6 | 6.0 | 24.8 |
| orderOps | adira | 4 | 309.0 | 517.1 | 4.0 | 10.7 |
| orderOps | reference | 4 | 139.2 | 163.3 | 6.0 | 28.4 |
| replenishment | reference | 1 | 75.2 | 82.1 | 7.0 | 13.2 |
| replenishment | adira | 1 | 458.8 | 868.5 | 11.0 | 1.9 |
| replenishment | reference | 4 | 109.6 | 150.7 | 7.0 | 32.3 |
| replenishment | adira | 4 | 486.0 | 501.4 | 11.0 | 8.1 |

Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.
