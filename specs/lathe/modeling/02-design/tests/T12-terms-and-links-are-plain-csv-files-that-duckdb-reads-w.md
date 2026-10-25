---
id: LA-MOD-T12
kind: test
title: Terms and links are plain CSV files that DuckDB reads without the app
parent: LA-MOD
test_type: unit
run_by: lathe/test/diagrams.test.ts
links:
  proves: [LA-MOD-UC02-R01]
---
Lists and loads hand-written fixture CSVs, including quoted fields with commas, then queries a links file with plain DuckDB SQL.
