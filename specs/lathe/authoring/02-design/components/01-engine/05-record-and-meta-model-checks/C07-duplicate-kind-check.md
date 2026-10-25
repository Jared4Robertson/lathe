---
id: LA-AUT-C07
kind: component
title: Duplicate kind check
parent: LA-AUT-LAY06
component_type: sql check
file: lathe/checks/19-meta-duplicate-kind.sql
links:
  satisfies: [LA-AUT-UC04-R04, LA-AUT-DR14]
---
The `meta-duplicate-kind` check, per folder: a kind with two rows in one folder's `kinds.csv`, named with that file.
