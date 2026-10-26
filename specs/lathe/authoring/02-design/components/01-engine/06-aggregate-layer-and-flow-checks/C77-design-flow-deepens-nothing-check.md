---
id: LA-AUT-C77
kind: component
title: Technical flow deepens nothing check
parent: LA-AUT-LAY07
component_type: sql check
file: lathe/checks/82-design-flow-deepens-nothing.sql
links:
  satisfies: [LA-AUT-UC17-R06, LA-AUT-DR80]
---
The `design-flow-deepens-nothing` warning: a technical flow with no `deepens` link. A link to a missing flow is left to `dangling-link`.
