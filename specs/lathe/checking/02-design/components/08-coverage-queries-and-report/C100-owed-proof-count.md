---
id: LA-CHK-C100
kind: component
title: Owed proof count
parent: LA-CHK-LAY08
component_type: sql queries
file: lathe/src/coverage.ts
links:
  satisfies: [LA-CHK-UC16-R01, LA-CHK-DR100, LA-CHK-DR102]
  depends_on: [LA-CHK-C20]
---
The `planned_any` column of `COVERAGE_COUNTS_SQL`: per domain and obligation kind, the obligations a 'proof' link from a planned source targets, proved or not. For a pattern rule only sources in the owing domain count, as for `planned`.
