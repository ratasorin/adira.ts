# Adira Operations Lab — medium

756,804 documents. 12 parity checks passed. 12 samples per variant/concurrency.

| Workload | Backend | Concurrency | p50 ms | p95 ms | Commands | req/s |
|---|---|---:|---:|---:|---:|---:|
| directory | adira | 1 | 13.6 | 19.6 | 1.0 | 68.1 |
| directory | reference | 1 | 6.5 | 8.1 | 1.0 | 148.7 |
| directory | adira | 4 | 17.1 | 29.4 | 1.0 | 184.5 |
| directory | reference | 4 | 10.8 | 15.8 | 1.0 | 304.0 |
| finances | reference | 1 | 58.0 | 95.2 | 6.0 | 16.0 |
| finances | adira | 1 | 296.5 | 341.8 | 1.0 | 3.3 |
| finances | reference | 4 | 76.7 | 104.6 | 6.0 | 43.5 |
| finances | adira | 4 | 442.1 | 606.6 | 1.0 | 7.9 |
| risk | adira | 1 | 735.3 | 885.3 | 18.0 | 1.3 |
| risk | reference | 1 | 67.6 | 77.0 | 10.0 | 14.8 |
| risk | adira | 4 | 900.9 | 964.5 | 18.0 | 4.2 |
| risk | reference | 4 | 111.5 | 190.1 | 10.0 | 30.6 |
| account360 | reference | 1 | 28.9 | 44.7 | 12.0 | 30.4 |
| account360 | adira | 1 | 367.2 | 509.6 | 5.0 | 2.5 |
| account360 | reference | 4 | 65.0 | 81.5 | 12.0 | 59.1 |
| account360 | adira | 4 | 439.8 | 469.1 | 5.0 | 8.9 |
| orderOps | adira | 1 | 205.2 | 237.8 | 4.0 | 4.9 |
| orderOps | reference | 1 | 24.1 | 28.8 | 6.0 | 39.4 |
| orderOps | adira | 4 | 268.1 | 286.8 | 4.0 | 14.8 |
| orderOps | reference | 4 | 67.1 | 88.0 | 6.0 | 55.7 |
| replenishment | reference | 1 | 53.9 | 63.4 | 7.0 | 19.0 |
| replenishment | adira | 1 | 533.1 | 609.8 | 11.0 | 1.9 |
| replenishment | reference | 4 | 69.0 | 94.2 | 7.0 | 52.4 |
| replenishment | adira | 4 | 690.1 | 764.0 | 11.0 | 5.6 |

Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.
