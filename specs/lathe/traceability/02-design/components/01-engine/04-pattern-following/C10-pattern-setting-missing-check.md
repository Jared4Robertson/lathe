---
id: LA-TRC-C10
kind: component
title: Pattern setting missing check
parent: LA-TRC-LAY05
component_type: sql check
file: lathe/checks/30-pattern-setting-missing.sql
links:
  satisfies: [LA-AUT-UC06-R06, LA-TRC-DR05]
---
The `pattern-setting-missing` check: splits each pattern's `settings` into names, keeps the valid ones, and for each use case that follows the pattern reports a name with no non-empty field, or with `Not applicable:` and no reason.
