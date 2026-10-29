# Adira Operations Lab — medium

756,804 documents. 12 parity checks passed. 12 samples per variant/concurrency.

| Workload | Backend | Concurrency | p50 ms | p95 ms | Commands | req/s |
|---|---|---:|---:|---:|---:|---:|
| directory | adira | 1 | 12.0 | 18.9 | 1.0 | 72.4 |
| directory | reference | 1 | 6.6 | 7.8 | 1.0 | 145.2 |
| directory | adira | 4 | 18.7 | 25.0 | 1.0 | 175.9 |
| directory | reference | 4 | 11.0 | 15.6 | 1.0 | 306.7 |
| finances | reference | 1 | 58.1 | 69.3 | 6.0 | 16.9 |
| finances | adira | 1 | 180.2 | 201.5 | 1.0 | 5.5 |
| finances | reference | 4 | 91.0 | 136.2 | 6.0 | 39.7 |
| finances | adira | 4 | 212.6 | 232.6 | 1.0 | 18.1 |
| risk | adira | 1 | 330.6 | 392.0 | 18.0 | 3.0 |
| risk | reference | 1 | 65.7 | 75.2 | 10.0 | 14.6 |
| risk | adira | 4 | 404.0 | 425.6 | 18.0 | 9.8 |
| risk | reference | 4 | 103.4 | 180.6 | 10.0 | 32.8 |
| account360 | reference | 1 | 29.6 | 37.4 | 12.0 | 31.0 |
| account360 | adira | 1 | 164.1 | 193.2 | 5.0 | 6.0 |
| account360 | reference | 4 | 65.9 | 89.7 | 12.0 | 55.2 |
| account360 | adira | 4 | 228.8 | 294.0 | 5.0 | 16.8 |
| orderOps | adira | 1 | 119.9 | 134.9 | 4.0 | 8.2 |
| orderOps | reference | 1 | 24.2 | 25.8 | 6.0 | 40.9 |
| orderOps | adira | 4 | 185.3 | 197.0 | 4.0 | 21.0 |
| orderOps | reference | 4 | 69.1 | 75.3 | 6.0 | 57.6 |
| replenishment | reference | 1 | 42.4 | 61.5 | 7.0 | 22.0 |
| replenishment | adira | 1 | 202.2 | 350.5 | 11.0 | 4.7 |
| replenishment | reference | 4 | 62.2 | 90.4 | 7.0 | 58.0 |
| replenishment | adira | 4 | 258.4 | 281.9 | 11.0 | 15.2 |

Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.
