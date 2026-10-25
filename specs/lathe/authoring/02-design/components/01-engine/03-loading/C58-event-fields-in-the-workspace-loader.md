---
id: LA-AUT-C58
kind: component
title: Event fields in the workspace loader
parent: LA-AUT-LAY04
component_type: engine module
file: lathe/src/index.ts
links:
  satisfies: [LA-AUT-UC13-R02, LA-AUT-DR65]
---
`loadWorkspace` reads each domain event's Fields table into its `entityFields` and into the `entity_tables` and `entity_fields` tables, alongside the entities', for the `entity-fields` check.
