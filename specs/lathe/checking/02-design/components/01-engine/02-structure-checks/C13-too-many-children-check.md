---
id: LA-CHK-C13
kind: component
title: Too many children check
parent: LA-CHK-LAY03
component_type: sql check
file: lathe/checks/64-too-many-children.sql
links:
  satisfies: [LA-CHK-UC06-R01, LA-CHK-DR14, LA-CHK-DR17, LA-CHK-DR18, LA-CHK-DR22, LA-CHK-UC06-R05]
---
Counts each record's children by kind, leaving out tests, and reports each kind whose count is more than the `structure.maxChildren` row of the `settings` table.
