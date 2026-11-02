# Adira Operations Lab — medium

756,804 documents. 12 parity checks passed. 12 samples per variant/concurrency.

| Workload | Backend | Concurrency | p50 ms | p95 ms | Commands | req/s |
|---|---|---:|---:|---:|---:|---:|
| directory | adira | 1 | 11.7 | 14.6 | 1.0 | 78.8 |
| directory | reference | 1 | 6.6 | 8.4 | 1.0 | 135.6 |
| directory | adira | 4 | 19.6 | 26.1 | 1.0 | 158.5 |
| directory | reference | 4 | 11.2 | 15.0 | 1.0 | 298.4 |
| finances | reference | 1 | 56.5 | 75.2 | 6.0 | 16.2 |
| finances | adira | 1 | 301.8 | 424.3 | 1.0 | 3.1 |
| finances | reference | 4 | 85.6 | 124.5 | 6.0 | 40.2 |
| finances | adira | 4 | 365.2 | 389.7 | 1.0 | 10.8 |
| risk | adira | 1 | 816.0 | 918.1 | 18.0 | 1.2 |
| risk | reference | 1 | 71.3 | 81.4 | 10.0 | 14.1 |
| risk | adira | 4 | 977.1 | 1047.2 | 18.0 | 4.0 |
| risk | reference | 4 | 127.0 | 204.7 | 10.0 | 27.2 |
| account360 | reference | 1 | 32.6 | 40.7 | 12.0 | 29.4 |
| account360 | adira | 1 | 178.0 | 192.5 | 5.0 | 5.6 |
| account360 | reference | 4 | 62.1 | 75.5 | 12.0 | 59.6 |
| account360 | adira | 4 | 218.9 | 246.8 | 5.0 | 17.4 |
| orderOps | adira | 1 | 205.8 | 267.1 | 4.0 | 4.6 |
| orderOps | reference | 1 | 25.6 | 32.9 | 6.0 | 36.9 |
| orderOps | adira | 4 | 277.0 | 365.5 | 4.0 | 12.5 |
| orderOps | reference | 4 | 140.2 | 353.1 | 6.0 | 19.2 |
| replenishment | reference | 1 | 45.4 | 70.6 | 7.0 | 20.6 |
| replenishment | adira | 1 | 616.5 | 710.2 | 11.0 | 1.6 |
| replenishment | reference | 4 | 73.2 | 88.5 | 7.0 | 50.2 |
| replenishment | adira | 4 | 704.3 | 807.1 | 11.0 | 5.4 |

Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.
