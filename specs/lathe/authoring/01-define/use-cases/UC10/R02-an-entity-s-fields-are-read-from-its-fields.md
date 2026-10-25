---
id: LA-AUT-UC10-R02
kind: requirement
title: An entity's fields are read from its Fields table
parent: LA-AUT-UC10
---
Loading MUST read each entity's `## Fields` table into its `entityFields`, one `{ field, meaning, kind, example }` per row in table order, and give the checks the table's facts. A table with the wrong columns MUST give no fields, and other kinds MUST have no `entityFields`.
