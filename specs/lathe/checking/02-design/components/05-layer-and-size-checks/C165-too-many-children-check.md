---
id: LA-CHK-C165
kind: component
title: Too many children check
parent: LA-CHK-LAY10
component_type: sql check
file: lathe/checks/64-too-many-children.sql
links:
  satisfies: [LA-CHK-UC23-R01, LA-CHK-DR170, LA-CHK-DR173, LA-CHK-DR174, LA-CHK-DR178, LA-CHK-UC23-R05]
---
Counts each record's children by kind, leaving out tests, and reports each kind whose count is more than the `structure.maxChildren` row of the `settings` table.
