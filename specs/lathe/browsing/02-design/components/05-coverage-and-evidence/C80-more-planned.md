---
id: LA-BRW-C80
kind: component
title: More planned beside the planned bar
parent: LA-BRW-LAY05
component_type: react component
file: app/src/specs/ProductHealth.tsx
links:
  satisfies: [LA-BRW-UC70-R01, LA-BRW-DR81]
  depends_on: [LA-BRW-C30]
---
`obligationGroups` reads `planned_any` into each group's `plannedAny`; `morePlanned` is the difference from `planned`, and `MorePlanned` draws `N more planned` inside the planned bar's row, after its value.
