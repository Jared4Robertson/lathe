---
id: LA-AUT-T135
kind: test
title: A technical flow that deepens no flow is a design-flow-deepens-nothing warning
parent: LA-AUT
test_type: unit
run_by: lathe/test/apis-and-design-flows.test.ts
links:
  proves: [LA-AUT-UC17-R06, LA-AUT-DR80]
---
Expects one `design-flow-deepens-nothing` warning on the technical flow with no `deepens`, and a technical flow under a flow reported as `parent-kind-not-allowed`.
