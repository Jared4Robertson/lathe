---
id: LA-CHK-C50
kind: component
title: Pattern rule coverage
parent: LA-CHK
component_type: sql queries
file: lathe/src/coverage.ts
links:
  satisfies: [LA-CHK-UC11-R02, LA-CHK-UC11-R03, LA-CHK-UC11-R04, LA-CHK-DR50, LA-CHK-DR51, LA-CHK-DR52]
---
The `follows` and `owed` steps of the coverage queries: each domain that follows a pattern owes each of its rules, unless the domain follows only through use cases and the rule's `setting` is `Not applicable:` with a reason in every one of them. For a rule owed this way, only design and proof links from records in that domain count, and its gaps carry that domain.
