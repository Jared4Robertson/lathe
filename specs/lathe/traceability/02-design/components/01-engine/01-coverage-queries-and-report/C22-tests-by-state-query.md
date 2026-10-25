---
id: LA-TRC-C22
kind: component
title: Tests by state query
parent: LA-TRC-LAY02
component_type: sql queries
file: lathe/src/coverage.ts
links:
  satisfies: [LA-TRC-UC06-R02, LA-TRC-DR17]
  depends_on: [LA-TRC-C01]
---
`COVERAGE_TESTS_SQL`: one row per domain record with its test records counted by state (`state` trimmed and lower-cased; none means automated). `computeCoverage` in `lathe/src/index.ts` puts the row on each domain's `Coverage.tests`.
