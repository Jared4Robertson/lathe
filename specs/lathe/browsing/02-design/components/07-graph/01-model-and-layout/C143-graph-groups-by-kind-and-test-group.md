---
id: LA-BRW-C143
kind: component
title: Graph groups by kind and by test group
parent: LA-BRW-LAY12
component_type: module
file: app/src/graph/model.ts
links:
  satisfies: [LA-BRW-UC110-R06, LA-BRW-DR141, LA-BRW-DR144, LA-BRW-DR145]
  implements: [LA-BRW-V20]
  depends_on: [LA-BRW-C140]
---
Folders a record's children by kind only when it has more than one kind, and draws a Tests folder's test-plan groups as nested group nodes (IDs such as `DM-SHOP/test/acceptance`) taken from the folder model.
