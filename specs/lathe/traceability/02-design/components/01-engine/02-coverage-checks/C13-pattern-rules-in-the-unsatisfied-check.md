---
id: LA-TRC-C13
kind: component
title: Pattern rules in the unsatisfied check
parent: LA-TRC-LAY03
component_type: sql check
file: lathe/checks/15-unsatisfied.sql
links:
  satisfies: [LA-TRC-UC04-R05, LA-TRC-DR08]
---
When pattern rules are full obligations (a product's `obligation: yes`), finds the domains that owe each one, by the same rules as the coverage queries, and warns once for each one with no component of its own satisfying the rule.
