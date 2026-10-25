---
id: LA-CHK-C178
kind: component
title: Unreached child entity check
parent: LA-CHK-LAY11
component_type: sql check
file: lathe/checks/70-entity-unreferenced.sql
links:
  satisfies: [LA-CHK-UC24-R07, LA-CHK-DR186, LA-CHK-DR187]
---
Walks `has_one` and `has_many` links inside each aggregate from its one root, and reports each child entity the walk does not reach.
