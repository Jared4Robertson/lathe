---
id: LA-CHK-T44
kind: test
title: A check reads the maxChildren setting from the settings table
parent: LA-CHK
test_type: unit
run_by: lathe/test/sizes.test.ts
links:
  proves: [LA-CHK-UC06-R02, LA-CHK-DR23]
---
Expects a product check that selects from the `settings` table to see the configured `structure.maxChildren`.
