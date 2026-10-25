---
id: LA-TRC-C28
kind: component
title: Domain follows in the unproved check
parent: LA-TRC-LAY03
component_type: sql check
file: lathe/checks/16-unproved.sql
links:
  satisfies: [LA-TRC-UC07-R01, LA-TRC-UC07-R02, LA-TRC-DR19, LA-TRC-DR20]
---
Finds the domains that owe each pattern rule, a domain that follows the pattern itself included, and warns once for each one with no automated or manual test of its own proving it.
