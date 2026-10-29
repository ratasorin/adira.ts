# Adira Operations Lab — medium

756,804 documents. 12 parity checks passed. 12 samples per variant/concurrency.

| Workload | Backend | Concurrency | p50 ms | p95 ms | Commands | req/s |
|---|---|---:|---:|---:|---:|---:|
| directory | adira | 1 | 10.9 | 15.8 | 1.0 | 83.4 |
| directory | reference | 1 | 5.7 | 7.7 | 1.0 | 164.3 |
| directory | adira | 4 | 16.5 | 24.7 | 1.0 | 189.1 |
| directory | reference | 4 | 11.2 | 14.8 | 1.0 | 309.5 |
| finances | reference | 1 | 61.4 | 71.8 | 6.0 | 16.1 |
| finances | adira | 1 | 101.0 | 132.1 | 10.0 | 9.5 |
| finances | reference | 4 | 94.8 | 113.6 | 6.0 | 38.2 |
| finances | adira | 4 | 140.8 | 158.6 | 10.0 | 26.6 |
| risk | adira | 1 | 214.8 | 255.6 | 25.0 | 4.7 |
| risk | reference | 1 | 69.4 | 102.8 | 10.0 | 13.7 |
| risk | adira | 4 | 287.1 | 311.4 | 25.0 | 13.4 |
| risk | reference | 4 | 130.4 | 171.1 | 10.0 | 26.6 |
| account360 | reference | 1 | 29.7 | 36.9 | 12.0 | 31.8 |
| account360 | adira | 1 | 160.0 | 173.3 | 6.0 | 6.1 |
| account360 | reference | 4 | 69.2 | 82.8 | 12.0 | 50.5 |
| account360 | adira | 4 | 195.9 | 222.0 | 6.0 | 19.3 |
| orderOps | adira | 1 | 122.7 | 146.2 | 4.0 | 7.9 |
| orderOps | reference | 1 | 24.2 | 27.1 | 6.0 | 40.4 |
| orderOps | adira | 4 | 196.7 | 329.5 | 4.0 | 18.0 |
| orderOps | reference | 4 | 66.8 | 104.3 | 6.0 | 51.6 |
| replenishment | reference | 1 | 48.0 | 96.8 | 7.0 | 18.7 |
| replenishment | adira | 1 | 128.2 | 133.7 | 11.0 | 7.8 |
| replenishment | reference | 4 | 61.6 | 89.8 | 7.0 | 58.2 |
| replenishment | adira | 4 | 158.4 | 195.2 | 11.0 | 22.8 |

Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.
