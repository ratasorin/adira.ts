# Adira Operations Lab — medium

756,804 documents. 12 parity checks passed. 5 samples per variant/concurrency.

| Workload      | Backend   | Concurrency | p50 ms | p95 ms | Commands | req/s |
| ------------- | --------- | ----------: | -----: | -----: | -------: | ----: |
| directory     | adira     |           1 |   20.8 |   23.4 |      1.0 |  46.1 |
| directory     | reference |           1 |    9.1 |    9.1 |      1.0 | 113.0 |
| directory     | adira     |           4 |   42.1 |   44.1 |      1.0 |  86.2 |
| directory     | reference |           4 |   19.5 |   23.8 |      1.0 | 164.9 |
| finances      | reference |           1 |   72.8 |  131.9 |      6.0 |  12.1 |
| finances      | adira     |           1 | 1607.4 | 1646.3 |      1.0 |   0.6 |
| finances      | reference |           4 |  120.4 |  137.7 |      6.0 |  24.3 |
| finances      | adira     |           4 | 1648.6 | 1673.3 |      1.0 |   1.6 |
| risk          | adira     |           1 | 2225.5 | 2499.2 |     18.0 |   0.4 |
| risk          | reference |           1 |   87.5 |  104.8 |     10.0 |  11.4 |
| risk          | adira     |           4 | 2349.1 | 2546.0 |     18.0 |   1.1 |
| risk          | reference |           4 |  170.2 |  181.2 |     10.0 |  19.4 |
| account360    | reference |           1 |   35.5 |   42.7 |     12.0 |  26.0 |
| account360    | adira     |           1 | 1602.8 | 1909.8 |      5.0 |   0.6 |
| account360    | reference |           4 |  125.5 |  163.5 |     12.0 |  25.4 |
| account360    | adira     |           4 | 1566.0 | 1641.7 |      5.0 |   1.7 |
| orderOps      | adira     |           1 |  395.7 |  426.2 |      4.0 |   2.5 |
| orderOps      | reference |           1 |   29.5 |   30.9 |      6.0 |  33.6 |
| orderOps      | adira     |           4 |  534.1 |  544.5 |      4.0 |   5.9 |
| orderOps      | reference |           4 |   88.7 |   91.5 |      6.0 |  41.3 |
| replenishment | reference |           1 |   44.0 |   80.8 |      7.0 |  18.0 |
| replenishment | adira     |           1 | 1190.0 | 1214.7 |     11.0 |   0.8 |
| replenishment | reference |           4 |   64.8 |   80.3 |      7.0 |  45.0 |
| replenishment | adira     |           4 | 1216.4 | 1224.1 |     11.0 |   2.1 |

Measurements are local and synthetic. See report.json for environment, parity hashes, raw samples, plans, callback counts, memory samples, budget diagnostic and limitations.
