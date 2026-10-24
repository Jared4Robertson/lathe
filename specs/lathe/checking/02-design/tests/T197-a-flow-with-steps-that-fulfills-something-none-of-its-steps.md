---
id: LA-CHK-T197
kind: test
title: A flow with steps that fulfills something none of its steps does is a warning
parent: LA-CHK
test_type: unit
run_by: lathe/test/flow-steps.test.ts
links:
  proves: [LA-CHK-UC17-R05, LA-CHK-DR112]
---
Expects `flow-fulfills-differs-from-steps` on a flow that fulfills a rule none of its steps fulfills, naming the rule.
