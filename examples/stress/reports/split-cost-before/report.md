# Adira Operations Lab — medium

756,804 documents. 12 parity checks passed. 12 samples per variant/concurrency.

| Workload | Backend | Concurrency | p50 ms | p95 ms | Commands | req/s |
|---|---|---:|---:|---:|---:|---:|
| directory | adira | 1 | 10.5 | 13.6 | 1.0 | 88.0 |
| directory | reference | 1 | 7.1 | 10.0 | 1.0 | 133.0 |
| directory | adira | 4 | 18.0 | 29.1 | 1.0 | 190.5 |
| directory | reference | 4 | 11.5 | 15.0 | 1.0 | 316.2 |
| finances | reference | 1 | 56.7 | 67.4 | 6.0 | 17.5 |
| finances | adira | 1 | 344.4 | 449.5 | 1.0 | 2.8 |
| finances | reference | 4 | 93.3 | 122.8 | 6.0 | 35.6 |
| finances | adira | 4 | 405.3 | 517.3 | 1.0 | 9.1 |
| risk | adira | 1 | 1022.3 | 1564.2 | 18.0 | 0.9 |
| risk | reference | 1 | 78.7 | 121.7 | 10.0 | 11.7 |
| risk | adira | 4 | 1279.2 | 1458.0 | 18.0 | 3.0 |
| risk | reference | 4 | 136.8 | 192.4 | 10.0 | 26.6 |
| account360 | reference | 1 | 31.3 | 38.4 | 12.0 | 30.6 |
| account360 | adira | 1 | 245.7 | 301.5 | 5.0 | 4.0 |
| account360 | reference | 4 | 76.8 | 96.5 | 12.0 | 46.8 |
| account360 | adira | 4 | 276.3 | 305.8 | 5.0 | 14.0 |
| orderOps | adira | 1 | 150.5 | 201.0 | 4.0 | 6.6 |
| orderOps | reference | 1 | 26.7 | 36.0 | 6.0 | 36.5 |
| orderOps | adira | 4 | 200.7 | 228.9 | 4.0 | 19.0 |
| orderOps | reference | 4 | 73.6 | 82.8 | 6.0 | 53.3 |
| replenishment | reference | 1 | 45.4 | 83.7 | 7.0 | 18.7 |
| replenishment | adira | 1 | 587.9 | 619.5 | 11.0 | 1.7 |
| replenishment | reference | 4 | 62.6 | 102.8 | 7.0 | 56.1 |
| replenishment | adira | 4 | 652.3 | 736.6 | 11.0 | 5.9 |

Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.
