---
id: LA-CHK-T99
kind: test
title: An undesigned pattern rule is reported once for each domain that owes it
parent: LA-CHK
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-CHK-UC11-R05, LA-CHK-DR51]
---
Expects one `unsatisfied` warning per rule and owing domain with no component of its own, with the message naming the rule and the domain.
