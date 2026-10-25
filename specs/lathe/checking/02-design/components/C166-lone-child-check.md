---
id: LA-CHK-C166
kind: component
title: Lone child check
parent: LA-CHK
component_type: sql check
file: lathe/checks/65-lone-child.sql
links:
  satisfies: [LA-CHK-UC23-R03, LA-CHK-UC23-R04, LA-CHK-DR175, LA-CHK-DR176, LA-CHK-DR177, LA-CHK-DR178]
---
Counts each capability's and layer's own children, of every kind, and reports each that has exactly one, naming the child.
