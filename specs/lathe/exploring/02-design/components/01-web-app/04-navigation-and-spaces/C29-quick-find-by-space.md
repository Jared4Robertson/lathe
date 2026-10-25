---
id: LA-EXP-C29
kind: component
title: Quick find by space
parent: LA-EXP-LAY05
component_type: react component
file: app/src/shell/QuickFind.tsx
links:
  satisfies: [LA-EXP-UC07-R06, LA-EXP-DR16]
  depends_on: [LA-EXP-C27]
---
`rankScoped` ranks the current space's items and everything else apart; the results show them as two groups, the second under a divider, walked as one list by the arrow keys.
