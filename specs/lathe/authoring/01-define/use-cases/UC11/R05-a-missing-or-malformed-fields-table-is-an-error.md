---
id: LA-AUT-UC11-R05
kind: requirement
title: A missing or malformed Fields table is an error
parent: LA-AUT-UC11
---
An entity with no `## Fields` table, a table with other columns, a repeated field name or a row with no field name MUST be an `entity-fields` error that names the fix. Wrong columns MUST be reported alone.
