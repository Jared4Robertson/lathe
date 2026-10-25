---
id: LA-AUT-C29
kind: component
title: Unknown section check
parent: LA-AUT-LAY06
component_type: sql check
file: lathe/checks/60-unknown-section.sql
links:
  satisfies: [LA-AUT-UC08-R03, LA-AUT-DR37]
---
Reports each kind whose `section` is not a folder of the `sections` table.
