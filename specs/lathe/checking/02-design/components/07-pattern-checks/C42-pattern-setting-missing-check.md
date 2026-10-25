---
id: LA-CHK-C42
kind: component
title: Pattern setting missing check
parent: LA-CHK-LAY06
component_type: sql check
file: lathe/checks/30-pattern-setting-missing.sql
links:
  satisfies: [LA-CHK-UC10-R06, LA-CHK-DR42]
---
The `pattern-setting-missing` check: splits each pattern's `settings` into names, keeps the valid ones, and for each use case that follows the pattern reports a name with no non-empty field, or with `Not applicable:` and no reason.
