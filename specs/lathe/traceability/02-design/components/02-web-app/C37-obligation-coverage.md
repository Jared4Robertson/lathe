---
id: LA-TRC-C37
kind: component
title: Coverage by obligation kind
parent: LA-TRC-LAY06
component_type: react component
file: app/src/specs/ProductHealth.tsx
links:
  satisfies: [LA-TRC-UC11-R01, LA-TRC-UC11-R02, LA-TRC-DR32]
  depends_on: [LA-PLT-C09, LA-EXP-C09]
---
`obligationGroups` turns a domain's coverage into one group per obligation kind from `Coverage.obligations`, in the engine's order. `CoverageBars` draws each group (designed, built, proved, and planned with a hatched bar that is never drawn full), and the product's Summary totals them, with planned on its own line.
