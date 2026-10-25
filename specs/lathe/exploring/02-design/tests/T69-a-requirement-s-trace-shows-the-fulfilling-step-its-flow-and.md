---
id: LA-EXP-T69
kind: test
title: A requirement's trace shows the fulfilling step, its flow and the components it uses
parent: LA-EXP
test_type: unit
run_by: app/test/graph/flow-steps.test.ts
links:
  proves: [LA-EXP-UC06-R05, LA-EXP-F03-R03]
---
Expects the trace of a requirement to hold the step that fulfills it, its flow and the component it uses, in that column order, still laid out in columns.
