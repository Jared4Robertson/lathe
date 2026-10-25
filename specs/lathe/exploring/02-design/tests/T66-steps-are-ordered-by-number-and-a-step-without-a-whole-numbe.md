---
id: LA-EXP-T66
kind: test
title: Steps are ordered by number, and a step without a whole-number order goes last
parent: LA-EXP
test_type: unit
run_by: app/test/flow-steps.test.tsx
links:
  proves: [LA-EXP-F03-R01]
---
Expects `stepsOf` to order steps 2, 10, then one whose order is not a number.
