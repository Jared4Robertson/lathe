---
id: LA-CHK-T24
kind: test
title: A product check's name comes from its file name, not its check column
parent: LA-CHK
test_type: unit
run_by: lathe/test/product-checks.test.ts
links:
  proves: [LA-CHK-UC05-R02, LA-CHK-DR08]
---
Expects the problems of `01-one-record-view-per-aggregate.sql`, whose SQL returns `house-rule` as its check, under `one-record-view-per-aggregate`.
