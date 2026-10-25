---
id: LA-AUT-C44
kind: component
title: Unreached child entity check
parent: LA-AUT-LAY07
component_type: sql check
file: lathe/checks/70-entity-unreferenced.sql
links:
  satisfies: [LA-AUT-UC10-R07, LA-AUT-DR56, LA-AUT-DR57]
---
Walks `has_one` and `has_many` links inside each aggregate from its one root, and reports each child entity the walk does not reach.
