---
id: LA-AUT-T45
kind: test
title: A flow with steps that fulfills something none of its steps does is a warning
parent: LA-AUT
test_type: unit
run_by: lathe/test/flow-steps.test.ts
links:
  proves: [LA-AUT-UC06-R05, LA-AUT-DR26]
---
Expects `flow-fulfills-differs-from-steps` on a flow that fulfills a rule none of its steps fulfills, naming the rule.
