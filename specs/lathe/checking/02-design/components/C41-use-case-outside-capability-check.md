---
id: LA-CHK-C41
kind: component
title: Use case outside capability check
parent: LA-CHK
component_type: sql check
file: lathe/checks/29-use-case-outside-capability.sql
links:
  satisfies: [LA-CHK-UC10-R04, LA-CHK-DR41]
---
The `use-case-outside-capability` check: a warning for each use case whose parent is a domain that has at least one capability.
