---
id: LA-PLT-C01
kind: component
title: Workspace loader
parent: LA-PLT-LAY01
component_type: service
file: lathe/src/index.ts
links:
  satisfies: [LA-PLT-UC01-R01, LA-PLT-UC01-R02, LA-CHK-UC01-R05, LA-CHK-UC02-R02, LA-AUT-UC03-R01, LA-AUT-UC03-R02, LA-AUT-DR08, LA-PLT-DR01, LA-CHK-DR04, LA-AUT-UC01-R03, LA-TRC-UC01-R01, LA-TRC-UC01-R02, LA-TRC-UC01-R04, LA-TRC-DR01]
  depends_on: [LA-CHK-C02, LA-PLT-C02, LA-AUT-C03, LA-AUT-C04]
---
`loadWorkspace(root)`: reads the meta-model, finds and parses every record file, computes product, domain and file facts, loads everything into in-memory DuckDB, runs the checks in order, and computes coverage per domain and obligation kind with the SQL in `lathe/src/coverage.ts`: designed, built (the designing component's file exists), proved and planned.
