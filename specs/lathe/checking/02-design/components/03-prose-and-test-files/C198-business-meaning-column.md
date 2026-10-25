---
id: LA-CHK-C198
kind: component
title: Business meaning column
parent: LA-CHK-LAY03
component_type: service
file: lathe/src/parse.ts
links:
  satisfies: [LA-CHK-UC27-R04, LA-CHK-DR209]
---
`FIELDS_COLUMN_ALIASES` in the record parser gives Business meaning as another name for the Meaning column, and `hasFieldsColumns` accepts either, trimmed and in any letter case.
