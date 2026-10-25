---
id: LA-AUT-C21
kind: component
title: Flow step order check
parent: LA-AUT-LAY07
component_type: sql check
file: lathe/checks/50-flow-step-order.sql
links:
  satisfies: [LA-AUT-UC07-R02, LA-AUT-UC07-R03, LA-AUT-DR24, LA-CHK-DR12, LA-AUT-UC14-R03, LA-AUT-DR68, LA-AUT-DR69]
---
The `flow-step-order` error: a step whose trimmed `order` is not digits, two steps with the same parent and `path` (main when absent, compared trimmed and in any letter case) whose orders are equal as numbers, or a path whose orders do not run 1, 2, 3 without a gap, checked only when every step of the path has a whole order of its own. An empty order is left to `missing-required-field`.
