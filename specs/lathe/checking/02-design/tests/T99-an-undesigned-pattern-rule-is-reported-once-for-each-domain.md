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
Expects no `unsatisfied` warning for pattern rules by default, since they need proof only; the per-domain warning naming the rule and the domain, when a product asks for design, is tested by LA-CHK-T228.
