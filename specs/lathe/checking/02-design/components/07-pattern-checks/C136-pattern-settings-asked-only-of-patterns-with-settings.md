---
id: LA-CHK-C136
kind: component
title: Pattern settings asked only of patterns with settings
parent: LA-CHK-LAY06
component_type: sql check
file: lathe/checks/30-pattern-setting-missing.sql
links:
  satisfies: [LA-CHK-UC19-R03, LA-CHK-DR133]
---
The `pattern-setting-missing` check asks only for the settings a pattern lists, so a pattern with no `settings` field, or an empty one, asks nothing, and a domain that follows a pattern is never asked.
