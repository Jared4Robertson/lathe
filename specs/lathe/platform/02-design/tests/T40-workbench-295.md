---
id: LA-PLT-T40
kind: test
title: Every grid says its columns, a single column being minmax(0, 1fr), so content shrinks with its panel
parent: LA-PLT
test_type: unit
run_by: app/test/standards.test.tsx
links:
  proves: [LA-PAT-APP-CODE-R10]
---
Reads every style rule and expects each grid, other than a centering icon grid, to declare its columns.
