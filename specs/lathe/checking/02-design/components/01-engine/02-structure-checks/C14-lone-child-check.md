---
id: LA-CHK-C14
kind: component
title: Lone child check
parent: LA-CHK-LAY03
component_type: sql check
file: lathe/checks/65-lone-child.sql
links:
  satisfies: [LA-CHK-UC06-R03, LA-CHK-UC06-R04, LA-CHK-DR19, LA-CHK-DR20, LA-CHK-DR21, LA-CHK-DR22]
---
Counts each capability's and layer's own children, of every kind, and reports each that has exactly one, naming the child.
