---
id: LA-TRC-C02
kind: component
title: Unsatisfied check
parent: LA-TRC-LAY03
component_type: sql check
file: lathe/checks/15-unsatisfied.sql
links:
  satisfies: [LA-TRC-UC02-R02, LA-AUT-DR12]
  meets: [LA-STD-CODE-R01]
---
Warns about each obligation of any obligation kind that no design link targets.
