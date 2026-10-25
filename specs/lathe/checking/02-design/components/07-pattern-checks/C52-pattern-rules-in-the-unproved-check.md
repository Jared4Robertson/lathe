---
id: LA-CHK-C52
kind: component
title: Pattern rules in the unproved check
parent: LA-CHK-LAY06
component_type: sql check
file: lathe/checks/16-unproved.sql
links:
  satisfies: [LA-CHK-UC11-R05, LA-CHK-DR51]
---
Finds the domains that owe each pattern rule and warns once for each one with no automated or manual test of its own proving the rule, saying when its only test there is planned.
