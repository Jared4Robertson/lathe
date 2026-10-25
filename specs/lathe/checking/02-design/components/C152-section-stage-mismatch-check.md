---
id: LA-CHK-C152
kind: component
title: Section stage mismatch check
parent: LA-CHK
component_type: sql check
file: lathe/checks/61-section-stage-mismatch.sql
links:
  satisfies: [LA-CHK-UC21-R04, LA-CHK-DR152, LA-CHK-DR153]
---
Reports each kind whose folder has a stage other than the kind's own; a folder with no stage is never compared.
