---
id: LA-AUT-T83
kind: test
title: A product's own checks are held to the same rule, and Lathe's defaults are all documented
parent: LA-AUT
test_type: unit
run_by: lathe/test/reference.test.ts
links:
  proves: [LA-AUT-UC11-R06, LA-CHK-DR26]
---
Expects an undocumented error for a product check with no header, and none for Lathe's defaults.
