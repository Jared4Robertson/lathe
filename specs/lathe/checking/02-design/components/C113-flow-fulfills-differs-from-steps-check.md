---
id: LA-CHK-C113
kind: component
title: Flow fulfills differs from steps check
parent: LA-CHK
component_type: sql check
file: lathe/checks/52-flow-fulfills-differs-from-steps.sql
links:
  satisfies: [LA-CHK-UC17-R05, LA-CHK-UC17-R06, LA-CHK-DR112]
---
The `flow-fulfills-differs-from-steps` warning: a flow with at least one step whose own `fulfills` target no step of it fulfills.
