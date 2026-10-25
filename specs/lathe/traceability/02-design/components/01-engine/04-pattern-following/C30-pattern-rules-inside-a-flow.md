---
id: LA-TRC-C30
kind: component
title: Pattern rules inside a flow
parent: LA-TRC-LAY05
component_type: sql check
file: lathe/checks/51-flow-step-fulfills-outside-flow.sql
links:
  satisfies: [LA-TRC-UC07-R09, LA-AUT-DR35]
---
Adds to a flow's reach the rules of the patterns its use cases or its domain follow, and the interaction requirements that fulfill them, and compares steps' `fulfills` links to pattern rules too.
