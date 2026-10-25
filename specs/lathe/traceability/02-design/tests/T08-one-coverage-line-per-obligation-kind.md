---
id: LA-TRC-T08
kind: test
title: The check prints one coverage line per domain and obligation kind, with planned counts
parent: LA-TRC
test_type: unit
run_by: lathe/test/coverage.test.ts
links:
  proves: [LA-TRC-UC02-R05]
---
Runs `lathe check` on a fixture and expects one coverage line per domain and obligation kind with designed, built, proved and planned counts.
