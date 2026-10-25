---
id: LA-AUT-C43
kind: component
title: Aggregate root check
parent: LA-AUT-LAY07
component_type: sql check
file: lathe/checks/67-aggregate-root.sql
links:
  satisfies: [LA-AUT-UC11-R04, LA-AUT-DR51, LA-AUT-DR57]
---
Counts the root entities of each aggregate that has entities, and reports one with none or with more than one, naming them.
