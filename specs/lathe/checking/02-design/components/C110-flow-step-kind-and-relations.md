---
id: LA-CHK-C110
kind: component
title: Flow step kind and relations
parent: LA-CHK
component_type: meta-model
file: lathe/meta/kinds.csv
links:
  satisfies: [LA-CHK-UC17-R01]
---
The `flow_step` row in `kinds.csv` (parent `flow`, requires `order`) and, in `relations.csv`, `fulfills` from a step to a requirement, interaction requirement or domain rule, and `uses` from a step to a view, endpoint or component.
