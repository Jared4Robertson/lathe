---
id: LA-CHK-T29
kind: test
title: Without a checks folder only Lathe's checks run
parent: LA-CHK
test_type: unit
run_by: lathe/test/product-checks.test.ts
links:
  proves: [LA-CHK-UC05-R01]
---
Loads a product with no `checks` key and expects every problem to come from one of Lathe's check files.
