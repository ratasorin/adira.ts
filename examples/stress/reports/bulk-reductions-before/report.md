# Adira Operations Lab — medium

756,804 documents. 12 parity checks passed. 12 samples per variant/concurrency.

| Workload | Backend | Concurrency | p50 ms | p95 ms | Commands | req/s |
|---|---|---:|---:|---:|---:|---:|
| directory | adira | 1 | 9.6 | 19.2 | 1.0 | 89.8 |
| directory | reference | 1 | 6.7 | 8.9 | 1.0 | 140.4 |
| directory | adira | 4 | 19.1 | 30.9 | 1.0 | 185.5 |
| directory | reference | 4 | 10.4 | 13.6 | 1.0 | 328.1 |
| finances | reference | 1 | 58.5 | 74.4 | 6.0 | 16.3 |
| finances | adira | 1 | 176.7 | 194.8 | 1.0 | 5.6 |
| finances | reference | 4 | 84.3 | 115.1 | 6.0 | 43.2 |
| finances | adira | 4 | 217.3 | 422.3 | 1.0 | 13.9 |
| risk | adira | 1 | 735.6 | 832.0 | 18.0 | 1.3 |
| risk | reference | 1 | 63.4 | 81.7 | 10.0 | 15.5 |
| risk | adira | 4 | 890.2 | 946.6 | 18.0 | 4.4 |
| risk | reference | 4 | 121.8 | 141.6 | 10.0 | 32.1 |
| account360 | reference | 1 | 30.6 | 39.5 | 12.0 | 31.7 |
| account360 | adira | 1 | 166.0 | 208.0 | 5.0 | 5.7 |
| account360 | reference | 4 | 67.0 | 86.9 | 12.0 | 57.8 |
| account360 | adira | 4 | 195.4 | 211.8 | 5.0 | 19.7 |
| orderOps | adira | 1 | 132.1 | 155.3 | 4.0 | 7.6 |
| orderOps | reference | 1 | 24.3 | 35.6 | 6.0 | 39.3 |
| orderOps | adira | 4 | 155.0 | 216.5 | 4.0 | 21.9 |
| orderOps | reference | 4 | 63.7 | 66.9 | 6.0 | 63.2 |
| replenishment | reference | 1 | 43.8 | 52.5 | 7.0 | 22.2 |
| replenishment | adira | 1 | 509.3 | 619.1 | 11.0 | 1.8 |
| replenishment | reference | 4 | 61.3 | 98.8 | 7.0 | 56.6 |
| replenishment | adira | 4 | 617.0 | 651.4 | 11.0 | 6.4 |

Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.
