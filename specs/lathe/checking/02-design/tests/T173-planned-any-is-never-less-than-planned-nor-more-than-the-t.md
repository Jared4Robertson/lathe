---
id: LA-CHK-T173
kind: test
title: planned_any is never less than planned nor more than the total, in every fixture
parent: LA-CHK
test_type: unit
run_by: lathe/test/owed-proof.test.ts
links:
  proves: [LA-CHK-DR100]
---
Loads several fixtures and checks, for every domain and obligation kind, that `planned <= planned_any <= total`, and that every domain reports its tests by the three states.
