---
id: LA-CHK-T23
kind: test
title: A product check runs after Lathe's checks, against the same tables
parent: LA-CHK
test_type: unit
run_by: lathe/test/product-checks.test.ts
links:
  proves: [LA-CHK-UC05-R01, LA-CHK-DR08, LA-CHK-DR10]
---
Loads a product whose checks folder holds a check over `records`, `links` and `fields`, and expects its warnings after every problem from Lathe's checks.
