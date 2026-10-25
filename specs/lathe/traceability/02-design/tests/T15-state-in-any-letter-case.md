---
id: LA-TRC-T15
kind: test
title: A test state is read in any letter case, the same way by the checks and by coverage
parent: LA-TRC
test_type: unit
run_by: lathe/test/tests-and-meta.test.ts
links:
  proves: [LA-TRC-UC03-R02]
---
Loads a workspace with a test whose state is `Manual` and expects no `bad-test-state` error and the rule it proves counted as proved.
