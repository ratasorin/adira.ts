# Adira Operations Lab — medium

756,804 documents. 12 parity checks passed. 12 samples per variant/concurrency.

| Workload | Backend | Concurrency | p50 ms | p95 ms | Commands | req/s |
|---|---|---:|---:|---:|---:|---:|
| directory | adira | 1 | 10.6 | 13.5 | 1.0 | 87.9 |
| directory | reference | 1 | 6.5 | 10.3 | 1.0 | 137.3 |
| directory | adira | 4 | 17.8 | 27.6 | 1.0 | 184.0 |
| directory | reference | 4 | 12.5 | 18.6 | 1.0 | 287.4 |
| finances | reference | 1 | 59.5 | 68.1 | 6.0 | 16.4 |
| finances | adira | 1 | 312.4 | 403.2 | 1.0 | 3.1 |
| finances | reference | 4 | 86.7 | 106.6 | 6.0 | 42.1 |
| finances | adira | 4 | 374.6 | 471.2 | 1.0 | 10.0 |
| risk | adira | 1 | 951.6 | 1105.4 | 18.0 | 1.0 |
| risk | reference | 1 | 68.4 | 85.7 | 10.0 | 14.1 |
| risk | adira | 4 | 1064.5 | 1101.5 | 18.0 | 3.7 |
| risk | reference | 4 | 126.1 | 142.0 | 10.0 | 30.9 |
| account360 | reference | 1 | 29.3 | 32.3 | 12.0 | 34.1 |
| account360 | adira | 1 | 182.5 | 192.1 | 5.0 | 5.4 |
| account360 | reference | 4 | 77.8 | 121.8 | 12.0 | 44.5 |
| account360 | adira | 4 | 230.9 | 291.9 | 5.0 | 16.1 |
| orderOps | adira | 1 | 118.1 | 148.0 | 4.0 | 8.3 |
| orderOps | reference | 1 | 22.8 | 31.1 | 6.0 | 40.5 |
| orderOps | adira | 4 | 173.9 | 212.1 | 4.0 | 20.9 |
| orderOps | reference | 4 | 60.9 | 70.0 | 6.0 | 63.8 |
| replenishment | reference | 1 | 47.5 | 58.1 | 7.0 | 20.6 |
| replenishment | adira | 1 | 524.1 | 620.7 | 11.0 | 1.8 |
| replenishment | reference | 4 | 63.9 | 79.9 | 7.0 | 59.0 |
| replenishment | adira | 4 | 657.5 | 725.6 | 11.0 | 5.9 |

Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.
