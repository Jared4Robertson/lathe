---
id: LA-BRW-C91
kind: component
title: Flow steps in the graph
parent: LA-BRW
component_type: module
file: app/src/graph/model.ts
links:
  satisfies: [LA-BRW-UC80-R04, LA-BRW-UC80-R05, LA-BRW-DR91, LA-BRW-DR92]
  depends_on: [LA-BRW-C20, LA-BRW-C40]
---
Puts `flow_step` one hierarchy tier right of `flow`, so steps hang under their flow (through a group when there are more than a handful, as for any children). In trace mode a fulfilling step sits between the flows and the components, and brings its flow and the components it uses.
