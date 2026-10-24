---
id: LA-BRW-T203
kind: test
title: Steps are ordered by number, and a step without a whole-number order goes last
parent: LA-BRW
test_type: unit
run_by: app/test/flow-steps.test.tsx
links:
  proves: [LA-BRW-DR90]
---
Expects `stepsOf` to order steps 2, 10, then one whose order is not a number.
