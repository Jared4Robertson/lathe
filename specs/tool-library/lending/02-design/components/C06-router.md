---
id: TL-LEND-C06
kind: component
title: router.ts
parent: TL-LEND
component_type: router
file: examples/tool-library/src/router.ts
links:
  implements: [TL-LEND-E01, TL-LEND-E02, TL-LEND-E03, TL-LEND-E04, TL-LEND-E05, TL-LEND-E06, TL-LEND-E07]
  satisfies: [TL-LEND-E01-R01, TL-LEND-E01-R02, TL-LEND-E01-R03, TL-LEND-E02-R01, TL-LEND-E02-R02, TL-LEND-E03-R01, TL-LEND-E04-R01, TL-LEND-E04-R02, TL-LEND-E04-R03, TL-LEND-E04-R04, TL-LEND-E04-R05, TL-LEND-E05-R01, TL-LEND-E05-R02, TL-LEND-E05-R03, TL-LEND-E06-R01, TL-LEND-E06-R02, TL-LEND-E06-R03, TL-LEND-E07-R01, TL-LEND-E07-R02]
  depends_on: [TL-LEND-C01, TL-LEND-C02, TL-LEND-C03, TL-LEND-C04, TL-LEND-C05]
---
The HTTP API on `node:http`. Matches each route, parses the JSON body (a body over 64 KB gives 413 `body_too_large`, and one that is not a JSON object 400 `invalid_json`), calls the service, and turns a `LendingError` into its status with `{ error, message }`, so a refused borrow tells the caller its reason. Unknown routes give 404 and wrong methods 405. Takes the clock and the library settings and passes the time zone to the lending service.
