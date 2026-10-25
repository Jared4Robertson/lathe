---
id: LA-AUT-T39
kind: test
title: Mentions are not links
parent: LA-AUT
test_type: unit
run_by: lathe/test/mentions.test.ts
links:
  proves: [LA-CHK-UC03-R05, LA-AUT-DR22]
---
Expects a workspace whose records only mention each other to have no links and no errors, and a requirement that a test and a use case mention to stay unsatisfied and unproved in the warnings and in coverage.
