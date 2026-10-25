---
id: LA-EXP-C10
kind: component
title: Graph groups
parent: LA-EXP-LAY02
component_type: module
file: app/src/graph/model.ts
links:
  satisfies: [LA-EXP-DR06, LA-EXP-DR07, LA-EXP-UC04-R01, LA-EXP-UC04-R02, LA-EXP-UC04-R03, LA-EXP-UC04-R04, LA-EXP-UC04-R05]
  depends_on: [LA-EXP-C03]
---
The group functions in the graph model: which records have their children grouped, a group's ID (its place in the graph's tree; only the tree's groups are groups), members, plural label and summed marks, and the framed picture's walk through groups, a level each. A group is a level of the parent/child tree, so it takes the column after its parent and before its members, in the map as in the framed picture.
