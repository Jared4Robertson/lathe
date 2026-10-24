---
id: LA-BRW-T206
kind: test
title: "A requirement's trace shows the fulfilling step, its flow and the components it uses"
parent: LA-BRW
test_type: unit
run_by: app/test/graph/flow-steps.test.ts
links:
  proves: [LA-BRW-UC80-R05, LA-BRW-DR92]
---
Expects the trace of a requirement to hold the step that fulfills it, its flow and the component it uses, in that tier order, still laid out in tiers.
