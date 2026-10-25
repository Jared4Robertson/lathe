---
id: LA-CHK-C101
kind: component
title: Tests by state query
parent: LA-CHK-LAY08
component_type: sql queries
file: lathe/src/coverage.ts
links:
  satisfies: [LA-CHK-UC16-R02, LA-CHK-DR101]
  depends_on: [LA-CHK-C20]
---
`COVERAGE_TESTS_SQL`: one row per domain record with its test records counted by state (`state` trimmed and lower-cased; none means automated). `computeCoverage` in `lathe/src/index.ts` puts the row on each domain's `Coverage.tests`.
