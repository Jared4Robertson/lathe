---
id: LA-TRC-T27
kind: test
title: A rule that names no setting applies in every following domain
parent: LA-TRC
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-TRC-UC04-R04]
---
Expects the rule with no `setting` counted in every following domain, including the one where the other rule is Not applicable.
