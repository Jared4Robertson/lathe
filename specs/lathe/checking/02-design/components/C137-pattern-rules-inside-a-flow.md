---
id: LA-CHK-C137
kind: component
title: Pattern rules inside a flow
parent: LA-CHK
component_type: sql check
file: lathe/checks/51-flow-step-fulfills-outside-flow.sql
links:
  satisfies: [LA-CHK-UC19-R09, LA-CHK-DR138]
---
Adds to a flow's reach the rules of the patterns its use cases or its domain follow, and the interaction requirements that fulfill them, and compares steps' `fulfills` links to pattern rules too.
