---
id: LA-CHK-T25
kind: test
title: S2's one Record view use case per aggregate is carried as a product check
parent: LA-CHK
test_type: unit
run_by: lathe/test/product-checks.test.ts
links:
  proves: [LA-CHK-UC05-R01]
---
Encodes S2's house rule as a product check against three aggregates with one, none and two Record view use cases, and expects warnings on the second and third only, naming the two use cases.
