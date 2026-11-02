# Adira Operations Lab — medium

756,804 documents. 12 parity checks passed. 12 samples per variant/concurrency.

| Workload | Backend | Concurrency | p50 ms | p95 ms | Commands | req/s |
|---|---|---:|---:|---:|---:|---:|
| directory | adira | 1 | 14.1 | 16.3 | 1.0 | 69.0 |
| directory | reference | 1 | 6.4 | 7.8 | 1.0 | 150.0 |
| directory | adira | 4 | 19.5 | 28.3 | 1.0 | 156.3 |
| directory | reference | 4 | 12.6 | 15.9 | 1.0 | 275.1 |
| finances | reference | 1 | 54.5 | 58.1 | 6.0 | 18.2 |
| finances | adira | 1 | 299.3 | 325.4 | 1.0 | 3.3 |
| finances | reference | 4 | 98.5 | 116.0 | 6.0 | 39.7 |
| finances | adira | 4 | 364.5 | 389.3 | 1.0 | 10.8 |
| risk | adira | 1 | 785.0 | 905.0 | 18.0 | 1.2 |
| risk | reference | 1 | 67.5 | 84.3 | 10.0 | 14.4 |
| risk | adira | 4 | 951.4 | 1014.4 | 18.0 | 4.1 |
| risk | reference | 4 | 117.4 | 163.3 | 10.0 | 30.3 |
| account360 | reference | 1 | 29.2 | 40.1 | 12.0 | 32.4 |
| account360 | adira | 1 | 167.1 | 175.3 | 5.0 | 6.0 |
| account360 | reference | 4 | 62.0 | 79.7 | 12.0 | 60.7 |
| account360 | adira | 4 | 203.4 | 237.1 | 5.0 | 18.7 |
| orderOps | adira | 1 | 214.3 | 264.1 | 4.0 | 4.4 |
| orderOps | reference | 1 | 24.7 | 33.6 | 6.0 | 38.8 |
| orderOps | adira | 4 | 260.9 | 330.1 | 4.0 | 13.6 |
| orderOps | reference | 4 | 77.2 | 99.3 | 6.0 | 48.2 |
| replenishment | reference | 1 | 42.1 | 62.4 | 7.0 | 21.5 |
| replenishment | adira | 1 | 583.8 | 737.9 | 11.0 | 1.7 |
| replenishment | reference | 4 | 60.4 | 78.8 | 7.0 | 58.7 |
| replenishment | adira | 4 | 680.5 | 752.1 | 11.0 | 5.7 |

Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.
