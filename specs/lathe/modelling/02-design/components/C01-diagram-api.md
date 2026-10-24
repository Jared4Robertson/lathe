---
id: LA-MOD-C01
kind: component
title: Diagram API
parent: LA-MOD
component_type: service
file: lathe/src/server/diagrams.ts
links:
  implements: [LA-MOD-E01, LA-MOD-E02, LA-MOD-E03]
  satisfies: [LA-MOD-DR01, LA-MOD-UC01-R01, LA-MOD-UC01-R02, LA-MOD-UC01-R03, LA-MOD-UC02-R02, LA-MOD-UC02-R03, LA-MOD-E01-R01, LA-MOD-E02-R01, LA-MOD-E03-R01]
  depends_on: [LA-MOD-C02]
---
Reads, checks and creates CSV diagrams. It reads the CSVs through an in-memory DuckDB, runs the package's `diagrams/checks.sql` against them, and creates diagram folders. `lathe/src/server/api.ts` serves it at `/api/diagrams`, both in `lathe serve` and in the app's dev server, and either sends `model:changed` when a file in the diagrams folder changes.
