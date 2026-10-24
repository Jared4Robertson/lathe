---
id: LA-CHK-C01
kind: component
title: Workspace loader
parent: LA-CHK
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC04-R01, LA-CHK-UC04-R02, LA-CHK-UC01-R05, LA-CHK-UC03-R02, LA-CHK-UC05-R01, LA-CHK-UC05-R02, LA-CHK-DR01, LA-CHK-DR04, LA-CHK-DR09, LA-MOD-UC03-R03, LA-CHK-UC02-R01, LA-CHK-UC02-R02, LA-CHK-UC02-R04, LA-CHK-DR07]
  depends_on: [LA-CHK-C03, LA-CHK-C04, LA-CHK-C05, LA-CHK-C06]
---
`loadWorkspace(root)`: reads the meta-model, finds and parses every record file, computes product, domain and file facts, loads everything into in-memory DuckDB, runs the checks in order, and computes coverage per domain and obligation kind with the SQL in `lathe/src/coverage.ts`: designed, built (the designing component's file exists), proved and planned.
