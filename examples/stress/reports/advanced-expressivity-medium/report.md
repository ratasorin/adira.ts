# Adira Operations Lab — medium

756,804 documents. 20 parity checks passed. 16 samples per variant/concurrency.

| Workload | Backend | Concurrency | p50 ms | p95 ms | Commands | req/s |
|---|---|---:|---:|---:|---:|---:|
| directory | adira | 1 | 10.4 | 15.4 | 1.0 | 89.2 |
| directory | reference | 1 | 6.2 | 7.8 | 1.0 | 149.5 |
| directory | adira | 4 | 17.4 | 26.7 | 1.0 | 178.1 |
| directory | reference | 4 | 12.1 | 14.4 | 1.0 | 275.9 |
| finances | adira | 1 | 94.8 | 130.3 | 10.0 | 10.3 |
| finances | reference | 1 | 57.4 | 65.6 | 6.0 | 17.1 |
| finances | adira | 4 | 138.1 | 158.5 | 10.0 | 26.4 |
| finances | reference | 4 | 84.0 | 94.3 | 6.0 | 42.9 |
| risk | adira | 1 | 209.6 | 254.5 | 25.0 | 4.7 |
| risk | reference | 1 | 67.7 | 79.5 | 10.0 | 14.4 |
| risk | adira | 4 | 299.5 | 313.9 | 25.0 | 13.0 |
| risk | reference | 4 | 122.8 | 155.9 | 10.0 | 28.4 |
| account360 | adira | 1 | 162.9 | 179.4 | 6.0 | 6.0 |
| account360 | reference | 1 | 30.8 | 62.6 | 12.0 | 29.1 |
| account360 | adira | 4 | 201.8 | 214.5 | 6.0 | 18.8 |
| account360 | reference | 4 | 69.5 | 75.1 | 12.0 | 54.3 |
| orderOps | adira | 1 | 123.5 | 165.4 | 4.0 | 7.6 |
| orderOps | reference | 1 | 24.8 | 45.0 | 6.0 | 35.1 |
| orderOps | adira | 4 | 205.0 | 280.9 | 4.0 | 17.8 |
| orderOps | reference | 4 | 66.2 | 72.3 | 6.0 | 58.6 |
| replenishment | adira | 1 | 128.1 | 140.1 | 11.0 | 7.9 |
| replenishment | reference | 1 | 44.8 | 67.3 | 7.0 | 20.8 |
| replenishment | adira | 4 | 174.1 | 187.7 | 11.0 | 22.0 |
| replenishment | reference | 4 | 64.9 | 129.6 | 7.0 | 46.9 |
| revenueQuality | adira | 1 | 273.2 | 333.6 | 22.0 | 3.6 |
| revenueQuality | reference | 1 | 66.4 | 78.2 | 5.0 | 15.3 |
| revenueQuality | adira | 4 | 345.2 | 362.4 | 22.0 | 11.3 |
| revenueQuality | reference | 4 | 101.8 | 107.1 | 5.0 | 38.1 |
| fulfillment | adira | 1 | 2438.8 | 2548.8 | 52.0 | 0.4 |
| fulfillment | reference | 1 | 136.9 | 174.4 | 5.0 | 7.0 |
| fulfillment | adira | 4 | 2910.4 | 3002.1 | 52.0 | 1.4 |
| fulfillment | reference | 4 | 408.4 | 445.7 | 5.0 | 9.5 |
| nestedTriage | adira | 1 | 94.8 | 121.5 | 14.0 | 10.0 |
| nestedTriage | reference | 1 | 18.8 | 24.0 | 8.0 | 51.2 |
| nestedTriage | adira | 4 | 109.4 | 135.5 | 14.0 | 32.3 |
| nestedTriage | reference | 4 | 28.9 | 37.1 | 8.0 | 122.8 |
| portfolioConcentration | adira | 1 | 256.0 | 324.5 | 15.0 | 3.8 |
| portfolioConcentration | reference | 1 | 41.3 | 52.1 | 5.0 | 23.4 |
| portfolioConcentration | adira | 4 | 349.0 | 465.5 | 15.0 | 10.5 |
| portfolioConcentration | reference | 4 | 65.3 | 80.3 | 5.0 | 56.2 |

Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.
