---
id: LA-TRC-T55
kind: test
title: A pattern may have no settings; its rules apply wherever it is followed and nothing asks for settings
parent: LA-TRC
test_type: unit
run_by: lathe/test/patterns-like-s2.test.ts
links:
  proves: [LA-TRC-UC07-R03, LA-TRC-DR21, LA-AUT-DR32]
---
A pattern with no `settings` field, followed by a domain and by a use case that gives no fields; expects no `missing-required-field`, `pattern-setting-missing` or `bad-pattern-settings`, and both rules owed.
