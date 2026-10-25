---
id: LA-TRC-T09
kind: test
title: A rule test keyed by the rule's ID needs no test ID in code
parent: LA-TRC
test_type: unit
run_by: lathe/test/tests-and-meta.test.ts
links:
  proves: [LA-TRC-UC03-R01]
---
Loads a test record whose `run_by` file names only the domain rule it proves, never the test's own ID, and expects no error on it.
