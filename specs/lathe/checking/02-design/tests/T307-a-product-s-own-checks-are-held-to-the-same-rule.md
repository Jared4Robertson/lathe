---
id: LA-CHK-T307
kind: test
title: A product's own checks are held to the same rule, and Lathe's defaults are all documented
parent: LA-CHK
test_type: unit
run_by: lathe/test/reference.test.ts
links:
  proves: [LA-CHK-UC25-R06, LA-CHK-DR193]
---
Expects an undocumented error for a product check with no header, and none for Lathe's defaults.
