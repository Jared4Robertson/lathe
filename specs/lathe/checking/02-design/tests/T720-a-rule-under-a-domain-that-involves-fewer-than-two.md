---
id: LA-CHK-T720
kind: test
title: "A rule under a domain that involves fewer than two aggregates is a warning that says to move a one-aggregate rule onto it; a link that dangles is not counted"
parent: LA-CHK
test_type: unit
run_by: lathe/test/domain-rule-involves.test.ts
links:
  proves: [LA-CHK-DR370]
---
Expects `domain-rule-involves` warnings for a rule under its domain that involves no aggregate, one that involves one, and one that involves one and a missing record, and none for rules that involve two or three of its aggregates.
