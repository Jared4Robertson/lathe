---
id: LA-TRC-T31
kind: test
title: A rule naming one of its pattern settings, or none, is not reported
parent: LA-TRC
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-TRC-UC04-R06]
---
Expects no `pattern-rule-setting-unknown` error for a rule naming a real setting, or for rules with no setting.
