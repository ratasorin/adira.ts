# Adira Operations Lab — medium

756,804 documents. 12 parity checks passed. 12 samples per variant/concurrency.

| Workload | Backend | Concurrency | p50 ms | p95 ms | Commands | req/s |
|---|---|---:|---:|---:|---:|---:|
| directory | adira | 1 | 11.3 | 16.5 | 1.0 | 83.0 |
| directory | reference | 1 | 5.2 | 5.8 | 1.0 | 185.4 |
| directory | adira | 4 | 21.9 | 30.1 | 1.0 | 158.2 |
| directory | reference | 4 | 13.3 | 25.9 | 1.0 | 250.6 |
| finances | reference | 1 | 56.8 | 68.1 | 6.0 | 17.3 |
| finances | adira | 1 | 96.8 | 113.5 | 10.0 | 10.4 |
| finances | reference | 4 | 80.5 | 95.3 | 6.0 | 44.7 |
| finances | adira | 4 | 148.2 | 165.6 | 10.0 | 24.8 |
| risk | adira | 1 | 216.4 | 235.8 | 25.0 | 4.6 |
| risk | reference | 1 | 70.7 | 77.5 | 10.0 | 13.9 |
| risk | adira | 4 | 282.3 | 345.9 | 25.0 | 13.6 |
| risk | reference | 4 | 115.1 | 174.5 | 10.0 | 30.6 |
| account360 | reference | 1 | 28.6 | 41.8 | 12.0 | 31.4 |
| account360 | adira | 1 | 201.8 | 290.4 | 6.0 | 4.9 |
| account360 | reference | 4 | 70.3 | 118.0 | 12.0 | 49.4 |
| account360 | adira | 4 | 254.8 | 334.1 | 6.0 | 14.7 |
| orderOps | adira | 1 | 142.8 | 203.1 | 4.0 | 6.3 |
| orderOps | reference | 1 | 29.9 | 79.6 | 6.0 | 28.6 |
| orderOps | adira | 4 | 252.4 | 358.1 | 4.0 | 14.8 |
| orderOps | reference | 4 | 73.6 | 82.7 | 6.0 | 53.9 |
| replenishment | reference | 1 | 45.3 | 67.8 | 7.0 | 20.6 |
| replenishment | adira | 1 | 140.3 | 196.7 | 11.0 | 6.7 |
| replenishment | reference | 4 | 76.9 | 197.8 | 7.0 | 36.5 |
| replenishment | adira | 4 | 181.2 | 206.5 | 11.0 | 21.0 |

Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.
