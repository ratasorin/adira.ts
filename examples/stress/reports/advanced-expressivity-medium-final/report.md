# Adira Operations Lab — medium

756,804 documents. 20 parity checks passed. 24 samples per variant/concurrency.

| Workload | Backend | Concurrency | p50 ms | p95 ms | Commands | req/s |
|---|---|---:|---:|---:|---:|---:|
| directory | adira | 1 | 11.0 | 13.6 | 1.0 | 87.4 |
| directory | reference | 1 | 6.0 | 8.3 | 1.0 | 152.6 |
| directory | adira | 4 | 17.9 | 23.3 | 1.0 | 187.5 |
| directory | reference | 4 | 10.4 | 14.0 | 1.0 | 298.8 |
| finances | adira | 1 | 97.2 | 107.9 | 10.0 | 10.3 |
| finances | reference | 1 | 56.6 | 66.1 | 6.0 | 17.2 |
| finances | adira | 4 | 143.6 | 161.9 | 10.0 | 25.5 |
| finances | reference | 4 | 81.2 | 93.5 | 6.0 | 43.9 |
| risk | adira | 1 | 214.4 | 249.5 | 25.0 | 4.6 |
| risk | reference | 1 | 70.3 | 88.2 | 10.0 | 13.7 |
| risk | adira | 4 | 305.2 | 354.2 | 25.0 | 12.4 |
| risk | reference | 4 | 117.5 | 131.5 | 10.0 | 31.5 |
| account360 | adira | 1 | 173.9 | 220.5 | 6.0 | 5.4 |
| account360 | reference | 1 | 29.4 | 36.6 | 12.0 | 31.4 |
| account360 | adira | 4 | 203.5 | 230.1 | 6.0 | 18.5 |
| account360 | reference | 4 | 71.4 | 123.9 | 12.0 | 46.5 |
| orderOps | adira | 1 | 126.4 | 146.9 | 4.0 | 7.8 |
| orderOps | reference | 1 | 27.3 | 36.0 | 6.0 | 34.5 |
| orderOps | adira | 4 | 210.5 | 292.8 | 4.0 | 17.0 |
| orderOps | reference | 4 | 69.6 | 79.6 | 6.0 | 54.1 |
| replenishment | adira | 1 | 151.5 | 219.1 | 11.0 | 6.3 |
| replenishment | reference | 1 | 54.8 | 74.6 | 7.0 | 17.8 |
| replenishment | adira | 4 | 184.2 | 283.5 | 11.0 | 19.1 |
| replenishment | reference | 4 | 73.0 | 91.4 | 7.0 | 50.4 |
| revenueQuality | adira | 1 | 283.9 | 355.8 | 22.0 | 3.4 |
| revenueQuality | reference | 1 | 63.5 | 87.4 | 5.0 | 15.8 |
| revenueQuality | adira | 4 | 355.1 | 387.4 | 22.0 | 10.9 |
| revenueQuality | reference | 4 | 101.6 | 119.3 | 5.0 | 36.3 |
| fulfillment | adira | 1 | 2797.0 | 3099.9 | 52.0 | 0.4 |
| fulfillment | adiraBatched | 1 | 363.7 | 431.3 | 48.0 | 2.7 |
| fulfillment | reference | 1 | 134.8 | 160.7 | 5.0 | 7.3 |
| fulfillment | adira | 4 | 3102.1 | 3307.0 | 52.0 | 1.3 |
| fulfillment | adiraBatched | 4 | 767.1 | 980.9 | 48.0 | 5.0 |
| fulfillment | reference | 4 | 423.7 | 529.2 | 5.0 | 9.1 |
| nestedTriage | adira | 1 | 113.4 | 127.8 | 13.0 | 8.6 |
| nestedTriage | reference | 1 | 16.5 | 21.3 | 8.0 | 58.3 |
| nestedTriage | adira | 4 | 139.4 | 151.1 | 13.0 | 27.1 |
| nestedTriage | reference | 4 | 30.2 | 36.9 | 8.0 | 119.2 |
| portfolioConcentration | adira | 1 | 307.5 | 361.2 | 15.0 | 3.2 |
| portfolioConcentration | reference | 1 | 44.4 | 64.7 | 5.0 | 21.3 |
| portfolioConcentration | adira | 4 | 392.0 | 434.7 | 15.0 | 9.8 |
| portfolioConcentration | reference | 4 | 79.2 | 83.4 | 5.0 | 49.3 |

Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.
