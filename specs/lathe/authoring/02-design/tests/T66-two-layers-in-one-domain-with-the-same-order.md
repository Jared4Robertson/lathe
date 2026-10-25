---
id: LA-AUT-T66
kind: test
title: Two layers in one domain with the same order are errors; another domain may reuse it
parent: LA-AUT
test_type: unit
run_by: lathe/test/layers.test.ts
links:
  proves: [LA-AUT-UC10-R02, LA-AUT-DR42, LA-AUT-DR43]
---
Expects errors for two layers of one domain with orders `1` and `01`, each naming the other, and none for a layer of another domain with order 1.
