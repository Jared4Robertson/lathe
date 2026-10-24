---
id: LA-CHK-C112
kind: component
title: Flow step fulfills outside flow check
parent: LA-CHK
component_type: sql check
file: lathe/checks/51-flow-step-fulfills-outside-flow.sql
links:
  satisfies: [LA-CHK-UC17-R04, LA-CHK-DR111, LA-CHK-DR113]
---
The `flow-step-fulfills-outside-flow` warning: compares each step's `fulfills` targets with its flow's reach (requirements of the use cases it carries out, the rules they apply, and interaction requirements fulfilling either or under the flow). Steps of a flow that carries out nothing, and targets that are missing or of another kind, are skipped.
