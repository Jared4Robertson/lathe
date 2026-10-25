---
id: LA-CHK-C51
kind: component
title: Pattern rules in the unsatisfied check
parent: LA-CHK
component_type: sql check
file: lathe/checks/15-unsatisfied.sql
links:
  satisfies: [LA-CHK-UC11-R05, LA-CHK-DR51]
---
When pattern rules are full obligations (a product's `obligation: yes`), finds the domains that owe each one, by the same rules as the coverage queries, and warns once for each one with no component of its own satisfying the rule.
