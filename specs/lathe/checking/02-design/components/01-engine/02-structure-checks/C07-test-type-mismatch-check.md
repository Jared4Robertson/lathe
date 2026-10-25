---
id: LA-CHK-C07
kind: component
title: Test type mismatch check
parent: LA-CHK-LAY03
component_type: sql check
file: lathe/checks/45-test-type-mismatch.sql
links:
  satisfies: [LA-CHK-UC04-R04, LA-CHK-DR05]
---
The `test-type-mismatch` warning: a `domain_rule` test proving only requirements, or an `acceptance` test proving only domain rules, with the IDs it proves. The type is compared in lower case.
