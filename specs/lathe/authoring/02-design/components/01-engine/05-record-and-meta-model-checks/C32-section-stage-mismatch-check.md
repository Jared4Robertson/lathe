---
id: LA-AUT-C32
kind: component
title: Section stage mismatch check
parent: LA-AUT-LAY06
component_type: sql check
file: lathe/checks/61-section-stage-mismatch.sql
links:
  satisfies: [LA-AUT-UC09-R04, LA-AUT-DR38, LA-AUT-DR39]
---
Reports each kind whose folder has a stage other than the kind's own; a folder with no stage is never compared.
