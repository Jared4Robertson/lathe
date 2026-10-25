---
id: LA-CHK-C54
kind: component
title: Pattern not followed check
parent: LA-CHK-LAY06
component_type: sql check
file: lathe/checks/34-pattern-not-followed.sql
links:
  satisfies: [LA-CHK-UC11-R07, LA-CHK-DR53]
---
The `pattern-not-followed` check: warns about each pattern with no `follows` link from a use case, counting the rules it leaves out of coverage.
