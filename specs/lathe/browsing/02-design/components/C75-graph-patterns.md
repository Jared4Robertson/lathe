---
id: LA-BRW-C75
kind: component
title: Patterns in the graph
parent: LA-BRW
component_type: module
file: app/src/graph/model.ts
links:
  satisfies: [LA-BRW-UC60-R08]
  depends_on: [LA-BRW-C20]
---
Puts a pattern in the use cases' tier and its rules in the requirements' tier, so rules sit under their pattern and a use case's `follows` link joins two records of one tier: drawn, but left out of the layout's layers. Offers trace mode for a pattern rule. The graph page draws `follows` in its own pattern line style, named in the legend.
