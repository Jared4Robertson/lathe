---
id: LA-CHK-T97
kind: test
title: A rule that names no setting applies in every following domain
parent: LA-CHK
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-CHK-UC11-R04]
---
Expects the rule with no `setting` counted in every following domain, including the one where the other rule is Not applicable.
