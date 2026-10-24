---
id: LA-CHK-T171
kind: test
title: A pattern rule has proof owed only in a domain whose own planned test is meant to prove it
parent: LA-CHK
test_type: unit
run_by: lathe/test/owed-proof.test.ts
links:
  proves: [LA-CHK-DR102, LA-CHK-UC16-R01]
---
Expects the pattern rule's `planned_any` to be 1 in the domain with a planned test for it and 0 in the other following domain, where only an automated test proves it.
