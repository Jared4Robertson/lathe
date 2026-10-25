---
id: LA-TRC-T50
kind: test
title: lathe check shows proof owed where it differs from planned, and each domain's tests by state
parent: LA-TRC
test_type: unit
run_by: lathe/test/owed-proof.test.ts
links:
  proves: [LA-TRC-UC06-R03]
---
Runs `lathe check` on `owed-proof` and expects `; 3/4 with a planned test` on the line where it differs, nothing added where it is equal, and one tests line per domain.
