---
id: LA-CHK-C111
kind: component
title: Flow step order check
parent: LA-CHK-LAY04
component_type: sql check
file: lathe/checks/50-flow-step-order.sql
links:
  satisfies: [LA-CHK-UC17-R02, LA-CHK-UC17-R03, LA-CHK-DR110, LA-CHK-DR113, LA-CHK-UC27-R03, LA-CHK-DR207, LA-CHK-DR208]
---
The `flow-step-order` error: a step whose trimmed `order` is not digits, two steps with the same parent and `path` (main when absent, compared trimmed and in any letter case) whose orders are equal as numbers, or a path whose orders do not run 1, 2, 3 without a gap, checked only when every step of the path has a whole order of its own. An empty order is left to `missing-required-field`.
