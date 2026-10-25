---
id: LA-TRC-C46
kind: component
title: Traceability logic
parent: LA-TRC-LAY06
component_type: module
file: app/src/specs/trace.ts
links:
  satisfies: [LA-TRC-UC14-R01, LA-TRC-UC14-R02, LA-TRC-UC14-R04, LA-TRC-DR37, LA-TRC-DR38]
  depends_on: [LA-TRC-C47, LA-TRC-C39, LA-EXP-C36]
---
`traceOf` groups a record's links by their labels in the order its kind calls for (an obligation's design, proof and support roles first; a component's designs and the tests proving them; a test's proofs and file), and `judge` reads an obligation's standing in a domain from coverage's gaps and the `component-file-missing` check, so the callouts never disagree with coverage. `owingDomains` finds the domains owing a pattern rule. Pure logic, tested directly.
