---
id: LA-CHK-C192
kind: component
title: Event fields in the workspace loader
parent: LA-CHK-LAY13
component_type: engine module
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC26-R02, LA-CHK-DR200]
---
`loadWorkspace` reads each domain event's Fields table into its `entityFields` and into the `entity_tables` and `entity_fields` tables, alongside the entities', for the `entity-fields` check.
