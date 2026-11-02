# Adira Operations Lab — medium

756,804 documents. 12 parity checks passed. 12 samples per variant/concurrency.

| Workload | Backend | Concurrency | p50 ms | p95 ms | Commands | req/s |
|---|---|---:|---:|---:|---:|---:|
| directory | adira | 1 | 14.4 | 23.6 | 1.0 | 66.3 |
| directory | reference | 1 | 8.8 | 11.5 | 1.0 | 105.2 |
| directory | adira | 4 | 20.2 | 32.0 | 1.0 | 159.8 |
| directory | reference | 4 | 10.4 | 14.4 | 1.0 | 319.3 |
| finances | reference | 1 | 55.7 | 77.0 | 6.0 | 16.9 |
| finances | adira | 1 | 837.3 | 1001.1 | 1.0 | 1.2 |
| finances | reference | 4 | 90.4 | 117.7 | 6.0 | 41.6 |
| finances | adira | 4 | 1010.0 | 1063.2 | 1.0 | 3.9 |
| risk | adira | 1 | 1285.7 | 1432.4 | 18.0 | 0.8 |
| risk | reference | 1 | 67.3 | 73.6 | 10.0 | 15.0 |
| risk | adira | 4 | 1536.9 | 1595.0 | 18.0 | 2.6 |
| risk | reference | 4 | 109.1 | 180.5 | 10.0 | 31.2 |
| account360 | reference | 1 | 29.6 | 34.4 | 12.0 | 32.7 |
| account360 | adira | 1 | 968.8 | 1086.0 | 5.0 | 1.0 |
| account360 | reference | 4 | 64.2 | 75.0 | 12.0 | 58.5 |
| account360 | adira | 4 | 1148.0 | 1237.6 | 5.0 | 3.4 |
| orderOps | adira | 1 | 284.3 | 330.8 | 4.0 | 3.5 |
| orderOps | reference | 1 | 23.8 | 25.8 | 6.0 | 42.4 |
| orderOps | adira | 4 | 363.4 | 418.1 | 4.0 | 10.6 |
| orderOps | reference | 4 | 61.5 | 71.6 | 6.0 | 64.4 |
| replenishment | reference | 1 | 43.2 | 62.1 | 7.0 | 21.5 |
| replenishment | adira | 1 | 857.0 | 1004.3 | 11.0 | 1.1 |
| replenishment | reference | 4 | 63.0 | 96.1 | 7.0 | 56.1 |
| replenishment | adira | 4 | 1034.7 | 1096.5 | 11.0 | 3.7 |

Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.
