---
id: LA-TRC-C12
kind: component
title: Pattern rule coverage
parent: LA-TRC-LAY02
component_type: sql queries
file: lathe/src/coverage.ts
links:
  satisfies: [LA-TRC-UC04-R02, LA-TRC-UC04-R03, LA-TRC-UC04-R04, LA-TRC-DR07, LA-TRC-DR08, LA-TRC-DR09]
---
The `follows` and `owed` steps of the coverage queries: each domain that follows a pattern owes each of its rules, unless the domain follows only through use cases and the rule's `setting` is `Not applicable:` with a reason in every one of them. For a rule owed this way, only design and proof links from records in that domain count, and its gaps carry that domain.
