---
id: LA-TRC-C12
kind: component
title: Pattern rule coverage
parent: LA-TRC-LAY02
component_type: sql queries
file: lathe/src/coverage.ts
links:
  satisfies: [LA-TRC-UC04-R02, LA-TRC-UC04-R03, LA-TRC-UC04-R04, LA-TRC-UC04-R09, LA-TRC-DR07, LA-TRC-DR08, LA-TRC-DR09, LA-TRC-DR39]
---
`OWED_PATTERN_RULES_SQL`, which builds the `owed_pattern_rules` table once at load, before the checks that read it run: each domain that follows a pattern owes each of its rules, unless the domain follows only through use cases and the rule's `setting` is `Not applicable:` with a reason in every one of them, or no follower there (a use case, or the domain itself) gives a value that meets the rule's `applies_when`. The coverage queries' `owed` step reads that table; for a rule owed this way, only design and proof links from records in that domain count, and its gaps carry that domain.
