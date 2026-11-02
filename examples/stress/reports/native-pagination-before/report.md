# Adira Operations Lab — medium

756,804 documents. 12 parity checks passed. 12 samples per variant/concurrency.

| Workload | Backend | Concurrency | p50 ms | p95 ms | Commands | req/s |
|---|---|---:|---:|---:|---:|---:|
| directory | adira | 1 | 13.9 | 22.1 | 1.0 | 67.7 |
| directory | reference | 1 | 6.7 | 9.6 | 1.0 | 138.4 |
| directory | adira | 4 | 17.7 | 26.0 | 1.0 | 176.5 |
| directory | reference | 4 | 12.2 | 16.1 | 1.0 | 304.7 |
| finances | reference | 1 | 60.3 | 76.3 | 6.0 | 16.0 |
| finances | adira | 1 | 311.9 | 412.2 | 1.0 | 3.1 |
| finances | reference | 4 | 88.7 | 123.4 | 6.0 | 38.5 |
| finances | adira | 4 | 357.0 | 385.4 | 1.0 | 10.8 |
| risk | adira | 1 | 759.8 | 904.3 | 18.0 | 1.3 |
| risk | reference | 1 | 75.5 | 83.8 | 10.0 | 13.8 |
| risk | adira | 4 | 923.2 | 1142.6 | 18.0 | 4.0 |
| risk | reference | 4 | 125.0 | 179.8 | 10.0 | 28.8 |
| account360 | reference | 1 | 27.7 | 37.6 | 12.0 | 33.6 |
| account360 | adira | 1 | 396.0 | 533.6 | 5.0 | 2.4 |
| account360 | reference | 4 | 66.4 | 73.0 | 12.0 | 57.2 |
| account360 | adira | 4 | 474.2 | 516.6 | 5.0 | 8.1 |
| orderOps | adira | 1 | 205.1 | 267.7 | 4.0 | 4.6 |
| orderOps | reference | 1 | 24.9 | 28.7 | 6.0 | 39.2 |
| orderOps | adira | 4 | 268.0 | 312.6 | 4.0 | 14.2 |
| orderOps | reference | 4 | 65.3 | 70.2 | 6.0 | 60.9 |
| replenishment | reference | 1 | 44.1 | 57.5 | 7.0 | 21.6 |
| replenishment | adira | 1 | 580.3 | 609.9 | 11.0 | 1.7 |
| replenishment | reference | 4 | 71.5 | 78.4 | 7.0 | 53.0 |
| replenishment | adira | 4 | 694.9 | 757.7 | 11.0 | 5.6 |

Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.
