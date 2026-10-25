---
id: LA-EXP-C29
kind: component
title: Quick find in the space
parent: LA-EXP-LAY05
component_type: react component
file: app/src/shell/QuickFind.tsx
links:
  satisfies: [LA-EXP-UC07-R06, LA-EXP-DR16]
  depends_on: [LA-EXP-C27, LA-EXP-C65]
---
`findItems` reads the current space's index, so only its records (and the format's kinds and checks) are found; `rankItems` ranks them as one list, walked by the arrow keys.
