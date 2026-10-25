---
id: LA-TRC-T73
kind: test
title: A test with at least one proof that counts is not reported
parent: LA-TRC
test_type: unit
run_by: lathe/test/owed-and-silent.test.ts
links:
  proves: [LA-TRC-DR26]
---
Expects no `proof-counts-nowhere` on a test that proves one counted requirement beside a rule counted nowhere, and exactly the expected tests reported.
