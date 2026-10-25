---
id: LA-AUT-T32
kind: test
title: A rule whose setting is not one of its pattern's settings is an error
parent: LA-AUT
test_type: unit
run_by: lathe/test/pattern-rules.test.ts
links:
  proves: [LA-TRC-UC04-R06, LA-AUT-DR18]
---
Expects exactly one `pattern-rule-setting-unknown` error, on the rule naming a misspelled setting, listing the pattern's settings.
