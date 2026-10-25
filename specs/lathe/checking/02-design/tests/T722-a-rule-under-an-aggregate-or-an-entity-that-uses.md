---
id: LA-CHK-T722
kind: test
title: "A rule under an aggregate or an entity that uses involves is a warning; one without involves is not"
parent: LA-CHK
test_type: unit
run_by: lathe/test/domain-rule-involves.test.ts
links:
  proves: [LA-CHK-DR370]
---
Expects one `domain-rule-involves` warning each for a rule under an aggregate and a rule under an entity that use `involves`, none for a rule under an aggregate without it, and only warnings from the check.
