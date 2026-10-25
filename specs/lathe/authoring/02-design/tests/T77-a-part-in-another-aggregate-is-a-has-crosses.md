---
id: LA-AUT-T77
kind: test
title: A part in another aggregate is a has-crosses-aggregate error
parent: LA-AUT
test_type: unit
run_by: lathe/test/entities.test.ts
links:
  proves: [LA-AUT-UC11-R06, LA-AUT-DR54, LA-AUT-DR55, LA-AUT-DR57]
---
Expects a `has-crosses-aggregate` error for a `has_many` into another aggregate, and none for `refers_to` across aggregates and domains.
