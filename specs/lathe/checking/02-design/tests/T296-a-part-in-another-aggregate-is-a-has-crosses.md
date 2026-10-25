---
id: LA-CHK-T296
kind: test
title: A part in another aggregate is a has-crosses-aggregate error
parent: LA-CHK
test_type: unit
run_by: lathe/test/entities.test.ts
links:
  proves: [LA-CHK-UC24-R06, LA-CHK-DR184, LA-CHK-DR185, LA-CHK-DR187]
---
Expects a `has-crosses-aggregate` error for a `has_many` into another aggregate, and none for `refers_to` across aggregates and domains.
