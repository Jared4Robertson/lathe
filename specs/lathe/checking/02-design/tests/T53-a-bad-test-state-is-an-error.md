---
id: LA-CHK-T53
kind: test
title: A test state other than automated, manual or planned is an error
parent: LA-CHK
test_type: unit
run_by: lathe/test/tests-and-meta.test.ts
links:
  proves: [LA-CHK-UC08-R02]
---
Loads a test with state `someday` and expects one `bad-test-state` error on it and nothing else.
