---
id: LA-TRC-C14
kind: component
title: Pattern rules in the unproved check
parent: LA-TRC-LAY03
component_type: sql check
file: lathe/checks/16-unproved.sql
links:
  satisfies: [LA-TRC-UC04-R05, LA-TRC-DR08]
---
Finds the domains that owe each pattern rule and warns once for each one with no automated or manual test of its own proving the rule, saying when its only test there is planned.
