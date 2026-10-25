---
id: LA-AUT-C41
kind: component
title: Entity fields in the workspace loader
parent: LA-AUT-LAY04
component_type: engine module
file: lathe/src/index.ts
links:
  satisfies: [LA-AUT-UC11-R02]
---
`loadWorkspace` reads each entity's Fields table into its `entityFields`, and writes the `entity_tables` and `entity_fields` tables the entity checks read.
