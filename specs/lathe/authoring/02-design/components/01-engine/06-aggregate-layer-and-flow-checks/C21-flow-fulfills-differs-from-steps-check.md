---
id: LA-AUT-C21
kind: component
title: Flow fulfills differs from steps check
parent: LA-AUT-LAY07
component_type: sql check
file: lathe/checks/52-flow-fulfills-differs-from-steps.sql
links:
  satisfies: [LA-AUT-UC06-R05, LA-AUT-UC06-R06, LA-AUT-DR26]
---
The `flow-fulfills-differs-from-steps` warning: a flow with at least one step whose own `fulfills` target no step of it fulfills.
