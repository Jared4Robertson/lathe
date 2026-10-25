---
id: LA-TRC-C42
kind: component
title: More planned beside the planned bar
parent: LA-TRC-LAY06
component_type: react component
file: app/src/specs/ProductHealth.tsx
links:
  satisfies: [LA-TRC-UC13-R01, LA-TRC-DR36]
  depends_on: [LA-TRC-C37]
---
`obligationGroups` reads `planned_any` into each group's `plannedAny`; `morePlanned` is the difference from `planned`, and `MorePlanned` draws `N more planned` inside the planned bar's row, after its value.
