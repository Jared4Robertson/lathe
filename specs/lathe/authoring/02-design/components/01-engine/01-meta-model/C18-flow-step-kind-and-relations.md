---
id: LA-AUT-C18
kind: component
title: Flow step kind and relations
parent: LA-AUT-LAY02
component_type: meta-model
file: lathe/meta/kinds.csv
links:
  satisfies: [LA-AUT-UC06-R01]
---
The `flow_step` row in `kinds.csv` (parent `flow`, requires `order`) and, in `relations.csv`, `fulfills` from a step to a requirement, interaction requirement or domain rule, and `uses` from a step to a view, endpoint or component.
