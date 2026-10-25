---
id: LA-BRW-C75
kind: component
title: Patterns in the graph
parent: LA-BRW-LAY07
component_type: module
file: app/src/graph/model.ts
links:
  satisfies: [LA-BRW-UC60-R08]
  depends_on: [LA-BRW-C20]
---
A pattern's rules are its children, so they sit one column to its right like any children, and a use case's `follows` link is a cross-link: a use case reached from the pattern by it sits one column after the pattern. Offers trace mode for a pattern rule. The graph page draws `follows` in its own pattern line style, named in the legend.
