---
id: LA-CHK-C111
kind: component
title: Flow step order check
parent: LA-CHK
component_type: sql check
file: lathe/checks/50-flow-step-order.sql
links:
  satisfies: [LA-CHK-UC17-R02, LA-CHK-UC17-R03, LA-CHK-DR110, LA-CHK-DR113]
---
The `flow-step-order` error: a step whose trimmed `order` is not digits, or two steps with the same parent whose orders are equal as numbers. An empty order is left to `missing-required-field`.
