---
id: LA-AUT-C19
kind: component
title: Step order check
parent: LA-AUT-LAY07
component_type: sql check
file: lathe/checks/50-step-order.sql
links:
  satisfies: [LA-AUT-UC06-R02, LA-AUT-UC06-R03, LA-AUT-DR24, LA-CHK-DR12, LA-AUT-UC13-R03, LA-AUT-DR68, LA-AUT-DR69, LA-AUT-UC17-R05, LA-AUT-DR78]
---
The `step-order` error, for the steps of a flow and of a technical flow alike: a step whose trimmed `order` is not digits, two steps with the same parent and `path` (main when absent, compared trimmed and in any letter case) whose orders are equal as numbers, or a path whose orders do not run 1, 2, 3 without a gap, checked only when every step of the path has a whole order of its own. Its messages name the step and its flow by their kinds' labels. An empty order is left to `missing-required-field`.
