---
id: LA-BRW-C102
kind: component
title: Quick find by space
parent: LA-BRW
component_type: react component
file: app/src/shell/QuickFind.tsx
links:
  satisfies: [LA-BRW-UC90-R06, LA-BRW-DR104]
  depends_on: [LA-BRW-C100]
---
`rankScoped` ranks the current space's items and everything else apart; the results show them as two groups, the second under a divider, walked as one list by the arrow keys.
