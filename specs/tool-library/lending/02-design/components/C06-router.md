---
id: TL-LEND-C06
kind: component
title: router.ts
parent: TL-LEND
component_type: router
file: examples/tool-library/src/router.ts
links:
  implements: [TL-LEND-E01, TL-LEND-E02, TL-LEND-E03, TL-LEND-E04, TL-LEND-E05, TL-LEND-E06, TL-LEND-E07]
  satisfies: [TL-LEND-UC03-R02, TL-LEND-UC03-R03, TL-LEND-UC03-R04]
  depends_on: [TL-LEND-C01, TL-LEND-C02, TL-LEND-C03, TL-LEND-C04, TL-LEND-C05]
---
The HTTP API on `node:http`. Matches each route, parses the JSON body (at most 64 KB), calls the service, and turns a `LendingError` into its status with `{ error, message }`, so a refused borrow tells the caller its reason. Unknown routes give 404 and wrong methods 405. Takes the clock and the library settings and passes the time zone to the lending service.
