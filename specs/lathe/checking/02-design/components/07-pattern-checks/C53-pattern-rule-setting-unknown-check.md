---
id: LA-CHK-C53
kind: component
title: Pattern rule setting unknown check
parent: LA-CHK-LAY06
component_type: sql check
file: lathe/checks/33-pattern-rule-setting-unknown.sql
links:
  satisfies: [LA-CHK-UC11-R06, LA-CHK-DR54]
---
The `pattern-rule-setting-unknown` check: compares each pattern rule's `setting` with the setting names its parent pattern lists, and reports one it does not list as an error.
