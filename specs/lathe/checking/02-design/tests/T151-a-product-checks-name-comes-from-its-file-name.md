---
id: LA-CHK-T151
kind: test
title: "A product check's name comes from its file name, not its check column"
parent: LA-CHK
test_type: unit
run_by: lathe/test/product-checks.test.ts
links:
  proves: [LA-CHK-UC15-R02, LA-CHK-DR90]
---
Expects the problems of `01-one-record-view-per-aggregate.sql`, whose SQL returns `house-rule` as its check, under `one-record-view-per-aggregate`.
