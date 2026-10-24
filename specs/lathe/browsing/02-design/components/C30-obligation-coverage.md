---
id: LA-BRW-C30
kind: component
title: Coverage by obligation kind
parent: LA-BRW
component_type: react component
file: app/src/specs/ProductHealth.tsx
links:
  satisfies: [LA-BRW-UC30-R01, LA-BRW-UC30-R02, LA-BRW-DR30]
  depends_on: [LA-BRW-C06]
---
`obligationGroups` turns a domain's coverage into one group per obligation kind from `Coverage.obligations`, in the engine's order, or into requirements and domain rules from the older fields while `obligations` is empty. `CoverageBars` draws each group (designed, built, proved, and planned with a hatched bar that is never drawn full), and the Evidence panel totals them, with planned on its own line.
