---
id: LA-EXP-C39
kind: component
title: Graph groups by kind and by test group
parent: LA-EXP-LAY02
component_type: module
file: app/src/graph/model.ts
links:
  satisfies: [LA-EXP-UC09-R06, LA-EXP-DR24, LA-EXP-DR27, LA-EXP-DR28]
  implements: [LA-EXP-V04]
  depends_on: [LA-EXP-C36]
---
Folders a record's children by kind only when it has more than one kind, and draws a Tests folder's test-plan groups as nested group nodes (IDs such as `DM-SHOP/test/acceptance`) taken from the folder model.
