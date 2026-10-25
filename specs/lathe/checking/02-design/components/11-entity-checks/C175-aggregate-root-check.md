---
id: LA-CHK-C175
kind: component
title: Aggregate root check
parent: LA-CHK-LAY11
component_type: sql check
file: lathe/checks/67-aggregate-root.sql
links:
  satisfies: [LA-CHK-UC24-R04, LA-CHK-DR181, LA-CHK-DR187]
---
Counts the root entities of each aggregate that has entities, and reports one with none or with more than one, naming them.
