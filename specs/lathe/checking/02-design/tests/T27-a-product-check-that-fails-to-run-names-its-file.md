---
id: LA-CHK-T27
kind: test
title: A product check that fails to run is an error naming its file
parent: LA-CHK
test_type: unit
run_by: lathe/test/product-checks.test.ts
links:
  proves: [LA-CHK-UC05-R04]
---
Adds a product check that reads a table that does not exist and expects one error under its check name that names `house-checks/03-broken.sql`.
