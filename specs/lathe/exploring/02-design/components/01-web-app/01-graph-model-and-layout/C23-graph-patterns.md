---
id: LA-EXP-C23
kind: component
title: Patterns in the graph
parent: LA-EXP-LAY02
component_type: module
file: app/src/graph/model.ts
links:
  satisfies: [LA-EXP-UC04-R09]
  depends_on: [LA-EXP-C03]
---
A pattern's rules are its children, so they sit one column to its right like any children, and a use case's `follows` link is a cross-link: a use case reached from the pattern by it sits one column after the pattern. Offers trace mode for a pattern rule. The graph page draws `follows` in its own pattern line style, named in the legend.
