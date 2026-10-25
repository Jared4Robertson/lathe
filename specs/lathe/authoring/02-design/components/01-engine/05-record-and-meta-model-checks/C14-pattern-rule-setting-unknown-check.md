---
id: LA-AUT-C14
kind: component
title: Pattern rule setting unknown check
parent: LA-AUT-LAY06
component_type: sql check
file: lathe/checks/33-pattern-rule-setting-unknown.sql
links:
  satisfies: [LA-TRC-UC04-R06, LA-AUT-DR18]
---
The `pattern-rule-setting-unknown` check: compares each pattern rule's `setting` with the setting names its parent pattern lists, and reports one it does not list as an error.
