---
id: LA-CHK-C134
kind: component
title: Domain follows in the unproved check
parent: LA-CHK-LAY07
component_type: sql check
file: lathe/checks/16-unproved.sql
links:
  satisfies: [LA-CHK-UC19-R01, LA-CHK-UC19-R02, LA-CHK-DR130, LA-CHK-DR131]
---
Finds the domains that owe each pattern rule, a domain that follows the pattern itself included, and warns once for each one with no automated or manual test of its own proving it.
