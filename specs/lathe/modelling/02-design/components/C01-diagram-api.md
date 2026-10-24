---
id: LA-MOD-C01
kind: component
title: Diagram API
parent: LA-MOD
component_type: server plugin
file: app/server/model.ts
links:
  implements: [LA-MOD-E01, LA-MOD-E02, LA-MOD-E03]
  satisfies: [LA-MOD-DR01, LA-MOD-UC01-R01, LA-MOD-UC01-R02, LA-MOD-UC01-R03, LA-MOD-UC02-R02, LA-MOD-UC02-R03]
  depends_on: [LA-MOD-C02]
---
A Vite plugin serving the diagram endpoints. It reads the CSVs through an in-memory DuckDB, runs `model/checks.sql` against them, creates diagram folders, and sends a `model:changed` event when a file under `model/` changes.
