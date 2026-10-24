---
id: LA-BRW-C40
kind: component
title: Graph groups
parent: LA-BRW
component_type: module
file: app/src/graph/model.ts
links:
  satisfies: [LA-BRW-DR40, LA-BRW-DR41, LA-BRW-UC40-R01, LA-BRW-UC40-R02, LA-BRW-UC40-R03, LA-BRW-UC40-R04, LA-BRW-UC40-R05]
  depends_on: [LA-BRW-C20]
---
The group functions in the graph model: which records have their children grouped, a group's ID (`<parent-id>/<kind>`), members, plural label and summed marks, and the neighbourhood walk that passes through groups at half a hop each, opens a group when it is the focus, holds the focus or was opened, and gives each group the tier half a step before its members.
