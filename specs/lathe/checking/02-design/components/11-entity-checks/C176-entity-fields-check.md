---
id: LA-CHK-C176
kind: component
title: Entity fields check
parent: LA-CHK-LAY11
component_type: sql check
file: lathe/checks/68-entity-fields.sql
links:
  satisfies: [LA-CHK-UC24-R05, LA-CHK-DR182, LA-CHK-DR183, LA-CHK-DR187]
---
Reads `entity_tables` for a missing heading, a missing table or wrong columns, and `entity_fields` for repeated field names and rows with no field name.
