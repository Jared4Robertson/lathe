---
id: LA-CHK-T43
kind: test
title: The requirement and rule counts are kept, filled from the obligation counts
parent: LA-CHK
test_type: unit
run_by: lathe/test/coverage.test.ts
links:
  proves: [LA-CHK-UC07-R04, LA-CHK-DR22]
---
Expects the `requirements_*` and `rules_*` fields to equal the requirement and domain rule obligation entries in every fixture, with built never above designed.
