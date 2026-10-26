---
id: LA-EXP-C26
kind: component
title: Flow steps in the graph
parent: LA-EXP-LAY02
component_type: module
file: app/src/graph/model.ts
links:
  satisfies: [LA-EXP-UC06-R04, LA-EXP-UC06-R05, LA-EXP-F03-R02, LA-EXP-F03-R03, LA-EXP-UC06-R08]
  depends_on: [LA-EXP-C03, LA-EXP-C10]
---
A flow's steps are its children, so they hang one column right of the flow (through a group only when the flow has children of more than one kind, as for any record). In trace mode a fulfilling step sits in a column between the flows and the components, and brings its flow and the components it uses; a satisfying technical step sits just before the components, and brings its technical flow and the component it uses.
