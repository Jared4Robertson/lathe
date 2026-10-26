---
id: LA-TRC-C25
kind: component
title: Domain-level follows in coverage
parent: LA-TRC-LAY02
component_type: sql queries
file: lathe/src/coverage.ts
links:
  satisfies: [LA-TRC-UC07-R01, LA-TRC-UC07-R02, LA-TRC-DR19, LA-TRC-DR20, LA-TRC-DR21]
---
The followers step of `OWED_PATTERN_RULES_SQL`: a domain record that `follows` a pattern is one of its followers in that domain, beside the use cases that follow it. It owes every rule of the pattern that Not applicable cannot take away from it, and its own settings count towards each rule's `applies_when`; a rule owed both ways is counted once.
