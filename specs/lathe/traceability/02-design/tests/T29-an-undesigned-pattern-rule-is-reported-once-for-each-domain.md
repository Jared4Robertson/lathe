---
id: LA-TRC-T29
kind: test
title: An undesigned pattern rule is reported once for each domain that owes it
parent: LA-TRC
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-TRC-UC04-R05, LA-TRC-DR08]
---
Expects no `unsatisfied` warning for pattern rules by default, since they need proof only; the per-domain warning naming the rule and the domain, when a product asks for design, is tested by LA-TRC-T58.
