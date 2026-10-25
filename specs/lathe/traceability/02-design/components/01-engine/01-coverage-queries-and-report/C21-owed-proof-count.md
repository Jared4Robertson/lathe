---
id: LA-TRC-C21
kind: component
title: Owed proof count
parent: LA-TRC-LAY02
component_type: sql queries
file: lathe/src/coverage.ts
links:
  satisfies: [LA-TRC-UC06-R01, LA-TRC-DR16, LA-TRC-DR18]
  depends_on: [LA-TRC-C01]
---
The `planned_any` column of `COVERAGE_COUNTS_SQL`: per domain and obligation kind, the obligations a 'proof' link from a planned source targets, proved or not. For a pattern rule only sources in the owing domain count, as for `planned`.
