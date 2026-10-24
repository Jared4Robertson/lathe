---
id: LA-CHK-T102
kind: test
title: A rule naming one of its pattern settings, or none, is not reported
parent: LA-CHK
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-CHK-UC11-R06]
---
Expects no `pattern-rule-setting-unknown` error for a rule naming a real setting, or for rules with no setting.
