---
id: LA-AUT-C44
kind: component
title: Entity fields check
parent: LA-AUT-LAY07
component_type: sql check
file: lathe/checks/68-entity-fields.sql
links:
  satisfies: [LA-AUT-UC11-R05, LA-AUT-DR52, LA-AUT-DR53, LA-AUT-DR57, LA-AUT-UC13-R02, LA-AUT-DR65]
---
Reads `entity_tables`, for entities and domain events alike, for a missing heading, a missing table or wrong columns, and `entity_fields` for repeated field names and rows with no field name.
