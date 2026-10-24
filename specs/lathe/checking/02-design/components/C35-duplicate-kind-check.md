---
id: LA-CHK-C35
kind: component
title: Duplicate kind check
parent: LA-CHK
component_type: sql check
file: lathe/checks/19-meta-duplicate-kind.sql
links:
  satisfies: [LA-CHK-UC09-R04, LA-CHK-DR32]
---
The `meta-duplicate-kind` check, per folder: a kind with two rows in one folder's `kinds.csv`, named with that file.
