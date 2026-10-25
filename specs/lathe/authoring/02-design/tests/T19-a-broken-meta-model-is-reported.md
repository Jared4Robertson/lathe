---
id: LA-AUT-T19
kind: test
title: A meta-model that names undefined kinds or repeats itself is reported as errors
parent: LA-AUT
test_type: unit
run_by: lathe/test/checks.test.ts
links:
  proves: [LA-AUT-UC03-R03, LA-AUT-DR09]
---
Loads a meta-model with a duplicate kind, an undefined parent kind, undefined relation kinds, a duplicate relation rule and bad required field names, and expects one `meta-...` error with no record for each, and none for Lathe's own meta-model.
