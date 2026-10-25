---
id: LA-TRC-C15
kind: component
title: Pattern not followed check
parent: LA-TRC-LAY05
component_type: sql check
file: lathe/checks/34-pattern-not-followed.sql
links:
  satisfies: [LA-TRC-UC04-R07, LA-TRC-DR10]
---
The `pattern-not-followed` check: warns about each pattern with no `follows` link from a use case, counting the rules it leaves out of coverage.
