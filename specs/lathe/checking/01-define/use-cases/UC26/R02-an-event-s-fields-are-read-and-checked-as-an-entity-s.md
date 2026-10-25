---
id: LA-CHK-UC26-R02
kind: requirement
title: An event's fields are read and checked as an entity's
parent: LA-CHK-UC26
---
Loading MUST read each domain event's `## Fields` table into its `entityFields`, as for an entity. The `entity-fields` check MUST report an event's missing or malformed table, repeated field name or row with no field name as it does an entity's, naming the record as an event.
