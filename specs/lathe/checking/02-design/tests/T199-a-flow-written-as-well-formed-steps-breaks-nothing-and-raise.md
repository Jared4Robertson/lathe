---
id: LA-CHK-T199
kind: test
title: A flow written as well-formed steps breaks nothing and raises no step problem
parent: LA-CHK
test_type: unit
run_by: lathe/test/flow-steps.test.ts
links:
  proves: [LA-CHK-UC17-R01, LA-CHK-DR110]
---
Expects no errors and no flow step problem in a well-formed workspace, and every flow step check to fire in the broken one.
