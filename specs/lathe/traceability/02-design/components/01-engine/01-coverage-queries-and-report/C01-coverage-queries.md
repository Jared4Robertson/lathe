---
id: LA-TRC-C01
kind: component
title: Coverage queries
parent: LA-TRC-LAY02
component_type: sql queries
file: lathe/src/coverage.ts
links:
  satisfies: [LA-TRC-UC02-R01, LA-TRC-UC02-R02, LA-TRC-UC02-R03, LA-AUT-DR12, LA-TRC-DR02, LA-TRC-DR03]
---
The SQL that counts coverage from the meta-model: one row per domain and obligation kind, with designed, built, proved and planned counts, and one row per gap. It reads obligation kinds from `kinds`, design and proof relations from `relations` by role, and test states from `fields`.
