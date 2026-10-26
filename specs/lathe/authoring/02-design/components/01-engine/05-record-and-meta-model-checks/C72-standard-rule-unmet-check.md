---
id: LA-AUT-C72
kind: component
title: Standard rule unmet check
parent: LA-AUT-LAY06
component_type: sql check
file: lathe/checks/81-standard-rule-unmet.sql
links:
  satisfies: [LA-AUT-UC16-R03, LA-AUT-DR77]
  meets: [LA-STD-CODE-R01]
---
Warns of each standard rule that no `meets` link targets and that no record of its product cites in prose, other than the rule itself and its own standard, naming the link to add.
