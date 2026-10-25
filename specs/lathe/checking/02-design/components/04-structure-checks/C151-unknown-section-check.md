---
id: LA-CHK-C151
kind: component
title: Unknown section check
parent: LA-CHK-LAY04
component_type: sql check
file: lathe/checks/60-unknown-section.sql
links:
  satisfies: [LA-CHK-UC21-R03, LA-CHK-DR151]
---
Reports each kind whose `section` is not a folder of the `sections` table.
