---
id: LA-CHK-T101
kind: test
title: A rule whose setting is not one of its pattern's settings is an error
parent: LA-CHK
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-CHK-UC11-R06, LA-CHK-DR54]
---
Expects exactly one `pattern-rule-setting-unknown` error, on the rule naming a misspelled setting, listing the pattern's settings.
