---
id: LA-AUT-C42
kind: component
title: Entity role check
parent: LA-AUT-LAY07
component_type: sql check
file: lathe/checks/66-entity-role.sql
links:
  satisfies: [LA-AUT-UC11-R03, LA-AUT-DR50, LA-AUT-DR57]
---
Reports each entity whose non-empty `role` is not root or child, in any letter case.
