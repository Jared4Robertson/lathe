---
id: LA-AUT-C11
kind: component
title: Use case outside capability check
parent: LA-AUT-LAY06
component_type: sql check
file: lathe/checks/29-use-case-outside-capability.sql
links:
  satisfies: [LA-AUT-UC06-R04, LA-AUT-DR16]
---
The `use-case-outside-capability` check: a warning for each use case whose parent is a domain that has at least one capability.
