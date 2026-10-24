---
id: LA-CHK-C20
kind: component
title: Coverage queries
parent: LA-CHK
component_type: sql queries
file: lathe/src/coverage.ts
links:
  satisfies: [LA-CHK-UC07-R01, LA-CHK-UC07-R02, LA-CHK-UC07-R03, LA-CHK-DR20, LA-CHK-DR21, LA-CHK-DR22]
---
The SQL that counts coverage from the meta-model: one row per domain and obligation kind, with designed, built, proved and planned counts, and one row per gap. It reads obligation kinds from `kinds`, design and proof relations from `relations` by role, and test states from `fields`.
