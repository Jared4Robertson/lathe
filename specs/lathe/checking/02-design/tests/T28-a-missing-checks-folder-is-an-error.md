---
id: LA-CHK-T28
kind: test
title: A configured checks folder that does not exist is an error
parent: LA-CHK
test_type: unit
run_by: lathe/test/product-checks.test.ts
links:
  proves: [LA-CHK-UC05-R05, LA-CHK-DR11]
---
Loads a product whose config names a checks folder that is not there and expects one `product-checks-missing` error naming it.
