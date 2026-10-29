# Adira Operations Lab — medium

756,804 documents. 12 parity checks passed. 12 samples per variant/concurrency.

| Workload | Backend | Concurrency | p50 ms | p95 ms | Commands | req/s |
|---|---|---:|---:|---:|---:|---:|
| directory | adira | 1 | 11.4 | 15.1 | 1.0 | 83.0 |
| directory | reference | 1 | 5.1 | 6.3 | 1.0 | 182.9 |
| directory | adira | 4 | 18.7 | 22.1 | 1.0 | 191.6 |
| directory | reference | 4 | 10.9 | 16.0 | 1.0 | 306.0 |
| finances | reference | 1 | 53.8 | 65.2 | 6.0 | 17.9 |
| finances | adira | 1 | 183.3 | 278.4 | 1.0 | 5.2 |
| finances | reference | 4 | 83.4 | 115.0 | 6.0 | 42.2 |
| finances | adira | 4 | 239.9 | 307.7 | 1.0 | 15.1 |
| risk | adira | 1 | 895.2 | 1178.8 | 18.0 | 1.1 |
| risk | reference | 1 | 62.2 | 78.0 | 10.0 | 15.4 |
| risk | adira | 4 | 894.0 | 914.1 | 18.0 | 4.4 |
| risk | reference | 4 | 113.3 | 152.1 | 10.0 | 29.6 |
| account360 | reference | 1 | 31.9 | 37.4 | 12.0 | 30.5 |
| account360 | adira | 1 | 187.2 | 221.4 | 5.0 | 5.2 |
| account360 | reference | 4 | 61.7 | 75.4 | 12.0 | 59.9 |
| account360 | adira | 4 | 219.5 | 243.5 | 5.0 | 17.4 |
| orderOps | adira | 1 | 120.1 | 262.0 | 4.0 | 7.1 |
| orderOps | reference | 1 | 27.0 | 29.8 | 6.0 | 37.3 |
| orderOps | adira | 4 | 203.0 | 244.5 | 4.0 | 18.4 |
| orderOps | reference | 4 | 86.4 | 113.0 | 6.0 | 43.2 |
| replenishment | reference | 1 | 64.8 | 80.5 | 7.0 | 15.1 |
| replenishment | adira | 1 | 548.9 | 656.8 | 11.0 | 1.8 |
| replenishment | reference | 4 | 70.8 | 96.5 | 7.0 | 49.4 |
| replenishment | adira | 4 | 969.4 | 1070.4 | 11.0 | 4.0 |

Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.
