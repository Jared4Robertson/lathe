---
id: LA-TRC-T12
kind: test
title: A test state other than automated, manual or planned is an error
parent: LA-TRC
test_type: unit
run_by: lathe/test/tests-and-meta.test.ts
links:
  proves: [LA-TRC-UC03-R02]
---
Loads a test with state `someday` and expects one `bad-test-state` error on it and nothing else.
