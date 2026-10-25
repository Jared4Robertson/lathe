---
id: LA-CHK-T288
kind: test
title: Too many children and a lone child are warnings, never errors
parent: LA-CHK
test_type: unit
run_by: lathe/test/sizes.test.ts
links:
  proves: [LA-CHK-UC23-R01, LA-CHK-UC23-R03, LA-CHK-DR178]
---
Expects every `too-many-children` and `lone-child` problem to be a warning, and no errors in either fixture.
