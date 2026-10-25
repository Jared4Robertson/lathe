---
id: LA-AUT-T108
kind: test
title: A rule under an aggregate or an entity that uses involves is a warning; one without involves is not
parent: LA-AUT
test_type: unit
run_by: lathe/test/domain-rule-involves.test.ts
links:
  proves: [LA-AUT-DR72]
---
Expects one `domain-rule-involves` warning each for a rule under an aggregate and a rule under an entity that use `involves`, none for a rule under an aggregate without it, and only warnings from the check.
