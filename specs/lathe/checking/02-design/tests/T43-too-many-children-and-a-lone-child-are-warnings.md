---
id: LA-CHK-T43
kind: test
title: Too many children and a lone child are warnings, never errors
parent: LA-CHK
test_type: unit
run_by: lathe/test/sizes.test.ts
links:
  proves: [LA-CHK-UC06-R01, LA-CHK-UC06-R03, LA-CHK-DR22]
---
Expects every `too-many-children` and `lone-child` problem to be a warning, and no errors in either fixture.
