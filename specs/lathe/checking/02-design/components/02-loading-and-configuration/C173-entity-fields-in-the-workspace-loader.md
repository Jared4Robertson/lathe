---
id: LA-CHK-C173
kind: component
title: Entity fields in the workspace loader
parent: LA-CHK-LAY02
component_type: engine module
file: lathe/src/index.ts
links:
  satisfies: [LA-CHK-UC24-R02]
---
`loadWorkspace` reads each entity's Fields table into its `entityFields`, and writes the `entity_tables` and `entity_fields` tables the entity checks read.
