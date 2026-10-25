---
id: LA-CHK-C174
kind: component
title: Entity role check
parent: LA-CHK-LAY11
component_type: sql check
file: lathe/checks/66-entity-role.sql
links:
  satisfies: [LA-CHK-UC24-R03, LA-CHK-DR180, LA-CHK-DR187]
---
Reports each entity whose non-empty `role` is not root or child, in any letter case.
